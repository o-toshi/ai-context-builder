/**
 * Gemini に渡すシステム指示・プロンプト・テンプレート集。
 */

import type { GenerateContextRequest } from "@/types/gemini";

/**
 * 中間 JSON (ExecutableContext) を生成するための SYSTEM 指示。
 *
 * このプロンプトの設計思想は次の通り:
 *   1. 出力は『自己紹介』ではなく『AI に対する命令書』である
 *   2. 全項目は動詞の命令形（DO / DON'T / IF-THEN）
 *   3. 抽象語は禁止、観測可能な振る舞いに翻訳
 *   4. Priority Gate を最重要視（経営者の意思決定を AI に転写するため）
 *   5. 推測項目には末尾に [推定] を付ける
 */
export const EXTRACT_PROTOCOL_SYSTEM_INSTRUCTION = `
あなたは熟練のプロンプトエンジニアです。
ユーザーから受け取った「性格診断」「音声インタビュー（文字起こし＋声のトーン所見）」
「シナリオへの自由記述・選択」を分析し、
この人物専用の AI システムプロンプトの中間データ (JSON) を生成します。

【最上位ルール】
1. 出力は『自己紹介』ではなく、AI に対する『実行手順書』として機能すること。
   - NG: "結論から述べる傾向があります"
   - OK: "DO: 結論を最初の1行に書け。前置き・共感は省略しろ"
2. すべての statement / if / then / rationale は、動詞の命令形または条件文で書く。
3. 抽象語（"丁寧に", "論理的に", "誠実に"）は禁止。
   観測可能な振る舞い（"主張1つに根拠を2つ以上、数値で添えろ" 等）に翻訳すること。
4. priorityGates は最低3つ作成する。
   経営者・フリーランスが日々行っている判断の優先順位を凝縮したもので、
   「AとBで迷ったら常にA」の形にする。これがこの命令書の核心。
5. taboos には、ユーザーがインタビューで「うざい」「即解雇したくなる」と
   言及した具体的な言い回し・振る舞いを必ず含めること。最低3つ。
6. communicationStyle の各フィールドは、性格診断の数値から決定論的に推定する。
   - response_length が低い（短文好き）→ maxParagraphs は 2〜3
   - buffer_phrases が低い（緩衝表現を好まない）→ bufferPhrases='forbidden'
   - emoji_preference が低い → emoji='forbidden'
   - clarifying_questions が低い → allowClarifyingQuestions=false
7. examples セクションは、入力されたシナリオ自由記述の文体を踏襲した
   Good 例を最低 1 つ含めること。Bad 例には taboos の地雷ワードを使う。
8. 推測で補完した項目は、statement や rationale の末尾に「 [推定]」と付ける。
9. すべての文字列は日本語。

【出力形式】
JSON のみ。Markdown コードブロックや説明文は付けない。
スキーマは別途 responseSchema で強制されている。
`;

/**
 * USER メッセージ（中間 JSON 生成用）。
 *
 * 入力データを Gemini に渡す。
 */
export function buildExtractPrompt(req: GenerateContextRequest): string {
  return [
    "## ユーザー基本プロフィール",
    JSON.stringify(req.profile, null, 2),
    "",
    "## 性格診断（Likert 1〜5。3 が中立）",
    req.personality
      .map(
        (q) =>
          `- [${q.questionId}] (回答: ${q.value}) ${q.prompt}`,
      )
      .join("\n"),
    "",
    "## 音声インタビュー（文字起こし＋声のトーン所見）",
    req.interview
      .map((q) =>
        [
          `### ${q.questionId}`,
          `Q: ${q.prompt}`,
          `A (transcript): ${q.transcript ?? "(未回答)"}`,
          q.prosodyNote ? `Prosody: ${q.prosodyNote}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n"),
    "",
    "## シナリオ回答",
    req.scenarios
      .map((s) =>
        [
          `### ${s.scenarioId}`,
          `Q: ${s.prompt}`,
          s.choice ? `選択: ${s.choice}` : "",
          s.freeText ? `自由記述:\n${s.freeText}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n"),
    "",
    "上記からこの人物専用の ExecutableContext を JSON で生成してください。",
  ].join("\n");
}

/**
 * 音声文字起こし＋プロソディ抽出のための SYSTEM 指示。
 */
export const TRANSCRIBE_SYSTEM_INSTRUCTION = `
あなたは音声分析の専門家です。
渡された音声ファイルを文字起こしし、加えて声の特徴（プロソディ）を観察してください。

出力は次の JSON 形式に厳密に従うこと（Markdown コードブロック禁止）:
{
  "transcript": "全発話の文字起こし。フィラー（えーと、あの、等）も忠実に含める。",
  "prosody": {
    "tone": "声のトーン（例: '落ち着いた断定調', '早口で熱量高い', '困惑気味')",
    "pace": "slow | normal | fast",
    "confidence": "low | mid | high",
    "note": "その他、命令書作成に役立つ非言語特徴（語尾の癖、間の取り方など）"
  }
}
`;
