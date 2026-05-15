import { getGemini, MODELS } from "./client";
import {
  EXTRACT_PROTOCOL_SYSTEM_INSTRUCTION,
  buildExtractPrompt,
} from "./prompts";
import { EXECUTABLE_CONTEXT_SCHEMA } from "./schema";
import type { GenerateContextRequest } from "@/types/gemini";
import type { ExecutableContext } from "@/types/executable-context";
import { isoNow } from "@/lib/utils";

const RETRYABLE_STATUSES = ["429", "500", "502", "503", "504"];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_STATUSES.some((code) => message.includes(code));
}

async function generateContentWithRetry(
  req: GenerateContextRequest,
  modelName: string,
): Promise<string> {
  const genai = getGemini();
  const model = genai.getGenerativeModel({
    model: modelName,
    systemInstruction: EXTRACT_PROTOCOL_SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: EXECUTABLE_CONTEXT_SCHEMA,
    },
  });

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await model.generateContent(buildExtractPrompt(req));
      return result.response.text();
    } catch (error) {
      if (!isRetryableGeminiError(error) || attempt === maxAttempts) {
        throw error;
      }
      const waitMs = 1200 * 2 ** (attempt - 1);
      await sleep(waitMs);
    }
  }

  throw new Error("Gemini 呼び出しのリトライが上限に達しました");
}

/**
 * Gemini を使って入力データから ExecutableContext (中間 JSON) を抽出する。
 *
 * server-only。API ルートからのみ呼ばれる想定。
 */
export async function extractProtocols(
  req: GenerateContextRequest,
): Promise<ExecutableContext> {
  const textModel = MODELS.text();
  const fallbackModel = process.env.GEMINI_TEXT_FALLBACK_MODEL;

  let text: string;
  try {
    text = await generateContentWithRetry(req, textModel);
  } catch (primaryError) {
    if (!fallbackModel) {
      throw primaryError;
    }
    text = await generateContentWithRetry(req, fallbackModel);
  }

  let parsed: Omit<ExecutableContext, "meta" | "user"> & {
    userContextSummary?: { frequentTasks: string[]; stakeholders: string[] };
  };
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Gemini からの応答を JSON としてパースできませんでした: ${(err as Error).message}\n生応答: ${text.slice(0, 500)}`,
    );
  }

  const context: ExecutableContext = {
    meta: {
      version: "1.0.0",
      generatedAt: isoNow(),
      sourceVersions: {
        personality: "v1",
        interview: "v1",
        scenarios: "v1",
      },
    },
    user: {
      displayName: req.profile.displayName,
      role: req.profile.role,
      industry: req.profile.industry,
      teamSize: req.profile.teamSize,
      frequentTasks: parsed.userContextSummary?.frequentTasks,
      stakeholders: parsed.userContextSummary?.stakeholders,
    },
    coreIdentity: parsed.coreIdentity,
    priorityGates: parsed.priorityGates,
    responseProtocol: parsed.responseProtocol,
    communicationStyle: parsed.communicationStyle,
    thinkingProtocol: parsed.thinkingProtocol,
    decisionFramework: parsed.decisionFramework,
    triggers: parsed.triggers,
    taboos: parsed.taboos,
    examples: parsed.examples,
  };

  return context;
}

/**
 * Gemini を呼ばずに動かせる "drill / 開発用" のスタブ抽出器。
 *
 * GEMINI_API_KEY が未設定でも UI 動作を確認できるよう、
 * 入力からシンプルな決定論的ロジックで ExecutableContext を組み立てる。
 *
 * 本番では extractProtocols を使う。これは M1 の動作確認専用。
 */
export function extractProtocolsStub(
  req: GenerateContextRequest,
): ExecutableContext {
  // 性格診断から平均値を計算して、いくつかのフラグを決定する
  const avgOf = (ids: string[]) => {
    const values = req.personality
      .filter((p) => ids.includes(p.questionId))
      .map((p) => p.value);
    if (values.length === 0) return 3;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  const responseLength = avgOf(["p_clen_01"]); // 高いほど長文好き
  const negationTolerance = avgOf(["p_neg_01"]); // 高いほど反論にストレス
  const conclusionFirst = avgOf(["p_concl_01"]); // 高いほど結論先行
  const certaintyDemand = avgOf(["p_cert_01"]); // 高いほど確実性要求
  const bufferOk = avgOf(["p_buf_01"]); // 高いほど緩衝表現を好む
  const emojiOk = avgOf(["p_emo_01"]); // 高いほど絵文字を好む
  const clarifyOk = avgOf(["p_clar_01"]); // 高いほど質問返しを許容
  const speedFirst = avgOf(["p_pri_speed"]); // 高いほどスピード優先

  // 文字列要約
  const taboosFromInterview = req.interview
    .filter((i) => /うざい|うんざり|読みたくない|解雇|やめてほしい/.test(i.transcript ?? ""))
    .map((i) => `Avoid: ${i.transcript?.slice(0, 80) ?? ""}`)
    .slice(0, 3);

  return {
    meta: {
      version: "1.0.0-stub",
      generatedAt: isoNow(),
      sourceVersions: {
        personality: "v1",
        interview: "v1",
        scenarios: "v1",
      },
    },
    user: {
      displayName: req.profile.displayName,
      role: req.profile.role,
      industry: req.profile.industry,
      teamSize: req.profile.teamSize,
    },
    coreIdentity: {
      role: `${req.profile.role} の思考と判断を拡張する戦略パートナー`,
      stance: negationTolerance >= 4 ? "対等。ただし反論前に肯定を1行入れる" : "対等。忖度・過度な丁寧表現は禁止",
      failureMode: "言い訳より先に、原因と次の一手を提示せよ",
    },
    priorityGates: [
      {
        id: "pg_speed_quality",
        when: "速度と完璧さで迷ったら",
        choose: speedFirst >= 4 ? "速度（70点で出す）" : "品質（仕上げてから出す）",
        over: speedFirst >= 4 ? "完璧さ" : "速度",
        rationale:
          speedFirst >= 4
            ? "ユーザーは『動かしながら学ぶ』を重視している [推定]"
            : "ユーザーは品質と再現性を優先する傾向がある [推定]",
        intensity: "MUST",
      },
      {
        id: "pg_concl_first",
        when: "結論と背景のどちらを先に書くか迷ったら",
        choose: conclusionFirst >= 3.5 ? "結論を最初の1行に書く（BLUF）" : "背景を1段落だけ先に置く（SDS）",
        over: conclusionFirst >= 3.5 ? "背景・前置き" : "結論先行",
        rationale: "性格診断の結論先行スコアより [推定]",
        intensity: "MUST",
      },
      {
        id: "pg_cert",
        when: "曖昧な情報しかない論点を扱うとき",
        choose: certaintyDemand >= 4 ? "確度: 高/中/低 を明記する" : "推測でも構わず仮説を提示する",
        over: certaintyDemand >= 4 ? "曖昧な断定" : "判断保留",
        rationale: "確実性要求スコアより [推定]",
        intensity: "SHOULD",
      },
    ],
    responseProtocol: {
      structure: conclusionFirst >= 3.5 ? "BLUF" : "PREP",
      rules: [
        {
          intensity: "MUST",
          statement: "結論 → 根拠 → 補足 の順で出力せよ",
          source: "personality",
        },
        {
          intensity: responseLength <= 2 ? "MUST" : "SHOULD",
          statement: `1メッセージ最大${responseLength <= 2 ? 2 : 3}パラグラフ。長文化する場合は見出しで分割せよ`,
          source: "personality",
        },
        {
          intensity: bufferOk <= 2 ? "MUST" : "MAY",
          statement:
            bufferOk <= 2
              ? "DON'T: 「〜かもしれません」「いかがでしょうか」など緩衝表現を使うな"
              : "緩衝表現は最小限に留めよ",
          source: "personality",
        },
      ],
    },
    communicationStyle: {
      tone: "formal",
      maxParagraphs: responseLength <= 2 ? 2 : responseLength >= 4 ? 4 : 3,
      bufferPhrases: bufferOk <= 2 ? "forbidden" : "allowed",
      empathyPhrases: bufferOk <= 2 ? "forbidden" : "allowed",
      emoji: emojiOk <= 2 ? "forbidden" : emojiOk <= 3 ? "minimal" : "allowed",
      allowClarifyingQuestions: clarifyOk >= 4,
    },
    thinkingProtocol: {
      rules: [
        {
          intensity: "MUST",
          statement: "提案は2案以上 + 推奨1案 + 不採用理由を必ず添えよ",
          source: "inferred",
        },
        {
          intensity: certaintyDemand >= 4 ? "MUST" : "SHOULD",
          statement: "不確実性は『確度: 高/中/低』で明示せよ",
          source: "personality",
        },
        {
          intensity: negationTolerance >= 4 ? "SHOULD" : "MUST",
          statement:
            negationTolerance >= 4
              ? "反論する場合は、まず相手の意図を1行で肯定してから異論を述べよ"
              : "同意の前に異論を述べよ。遠慮による曖昧化は禁止",
          source: "personality",
        },
      ],
    },
    decisionFramework: {
      priorityOrder:
        speedFirst >= 4
          ? ["スピード", "品質", "コスト"]
          : ["品質", "スピード", "コスト"],
      riskTolerance: speedFirst >= 4 ? "high" : speedFirst >= 3 ? "mid" : "low",
      judgmentAxes: ["ROI", "学習機会", "関係性"],
    },
    triggers: [
      {
        id: "t_brainstorm",
        if: "ユーザーが『壁打ち』『ブレスト』と言ったら",
        then: "評価は保留し、質問のみで深掘りせよ",
        intensity: "MUST",
      },
      {
        id: "t_draft",
        if: "ユーザーが『ドラフト』『たたき』と言ったら",
        then: "完成度70%でいいので速度優先で提示せよ",
        intensity: "SHOULD",
      },
      {
        id: "t_emo",
        if: "ユーザーが感情的なトーンの文章を貼ってきたら",
        then: "まず事実と感情を分離して箇条書きで提示せよ",
        intensity: "MUST",
      },
    ],
    taboos:
      taboosFromInterview.length > 0
        ? taboosFromInterview.map((s) => ({
            intensity: "MUST" as const,
            statement: s,
            source: "interview" as const,
          }))
        : [
            {
              intensity: "MUST",
              statement: "DON'T: 「素晴らしいですね」など無個性な称賛から入るな",
              source: "inferred",
            },
            {
              intensity: "MUST",
              statement: "DON'T: 「一般的には〜」で始まる無個性な回答をするな",
              source: "inferred",
            },
            {
              intensity: "MUST",
              statement: "DON'T: 出典のない統計値を断定的に提示するな",
              source: "inferred",
            },
          ],
    examples: [
      {
        scenario: "新サービスの月額価格を3万円にするか相談された",
        good:
          "結論: 5万を推奨。\n根拠: ① 競合4.8万 ② 工数20h/月で時給1500円は安すぎ ③ 値上げより最初から正価が早い。\nリスク: 初期顧客の離脱可能性 → 既存客は据え置きで対応可。",
        bad:
          "素晴らしいアイデアですね！価格設定は重要ですよね。いくつか考慮すべきポイントがありますが、いかがでしょうか？",
      },
    ],
  };
}
