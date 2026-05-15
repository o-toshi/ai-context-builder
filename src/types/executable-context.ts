/**
 * 実行型命令セット (Executable Context) の中核となる型定義。
 *
 * このアプリの最終成果物である Markdown は、
 *   1. ユーザー入力（性格診断 / 音声 / シナリオ）
 *   2. Gemini で抽出される中間 JSON ＝ ExecutableContext
 *   3. ターゲット別レンダラで Markdown 化
 * という 3 層で構築される。本ファイルは 2 の構造を定義する。
 *
 * ポイントは「自己紹介ではなく実行手順書」にすること。
 * したがって全項目は次の何れかの形を持つ:
 *   - 命令文（DO / DON'T）
 *   - 条件分岐（IF / THEN）
 *   - 優先順位（A > B > C）
 */

/** 命令の強度。RFC 2119 準拠の 3 階層。 */
export type Intensity = "MUST" | "SHOULD" | "MAY";

/** すべての命令（ルール）の最小単位。 */
export interface Rule {
  /** 命令の強度。MUST = 鉄則・必須、SHOULD = 原則（外すときは理由）、MAY = 方針の目安・遵守は緩め。 */
  intensity: Intensity;
  /** 動詞で始まる命令文（例: "結論を最初の1行に書け"）。 */
  statement: string;
  /** 抽出元の根拠（性格診断・音声・シナリオのどれか）。任意。 */
  source?: "personality" | "interview" | "scenarios" | "inferred";
}

/** Priority Gate: 「AとBで迷ったら常にA」型の優先順位ルール。 */
export interface PriorityGate {
  id: string;
  /** 発動条件（例: "速度と完璧さで迷ったら"）。 */
  when: string;
  /** 選ぶべき側（例: "速度"）。 */
  choose: string;
  /** 不採用となる側（例: "完璧さ"）。 */
  over: string;
  /** なぜそれを優先するかの根拠（人間が読んで腹落ちする説明）。 */
  rationale: string;
  intensity: Intensity;
}

/** 条件付きルール（IF-THEN）。 */
export interface TriggerRule {
  id: string;
  /** 発動条件（自然文）。 */
  if: string;
  /** 取るべき振る舞い（命令形）。 */
  then: string;
  intensity: Intensity;
}

/** Good / Bad 例の対比。 */
export interface ExampleCase {
  scenario: string;
  good: string;
  bad: string;
}

/** ユーザー基本プロフィール（オンボーディングで取得）。 */
export interface UserProfile {
  displayName?: string;
  role: string;
  industry: string;
  teamSize: string;
  frequentTasks?: string[];
  stakeholders?: string[];
}

export interface CommunicationStyle {
  /** 文体: 敬体 / 常体 / 中性。 */
  tone: "formal" | "casual" | "flat";
  /** 1 メッセージで許容する段落数の上限（目安）。 */
  maxParagraphs: number;
  /** 緩衝表現（〜かもしれません等）の可否。 */
  bufferPhrases: "allowed" | "forbidden";
  /** 共感フレーズ（お気持ちわかります等）の可否。 */
  empathyPhrases: "allowed" | "forbidden";
  /** 絵文字の可否。 */
  emoji: "allowed" | "minimal" | "forbidden";
  /** 質問返しの許容度（false = 仮置きで進めること）。 */
  allowClarifyingQuestions: boolean;
}

export interface DecisionFramework {
  /** 優先順位（先頭から強い）。例: ["スピード", "品質", "コスト"] */
  priorityOrder: string[];
  riskTolerance: "low" | "mid" | "high";
  /** 判断軸（ROI・関係性・学習機会 など）。 */
  judgmentAxes: string[];
}

export interface CoreIdentity {
  role: string;
  stance: string;
  /** 失敗時の取るべき振る舞い。 */
  failureMode: string;
}

export interface ResponseProtocol {
  /** 応答構造の既定形式。 */
  structure: "BLUF" | "PREP" | "SDS" | "FREE";
  rules: Rule[];
}

export interface ThinkingProtocol {
  rules: Rule[];
}

/** 中間 JSON 全体。Gemini はこれを responseSchema で出力する。 */
export interface ExecutableContext {
  meta: {
    version: string;
    generatedAt: string;
    /** 抽出元データのバージョン（再生成時のトレース用）。 */
    sourceVersions: {
      personality: string;
      interview: string;
      scenarios: string;
    };
  };
  user: UserProfile;
  coreIdentity: CoreIdentity;
  /** Priority Gate ＝「迷ったらこちらを選べ」のリスト。 */
  priorityGates: PriorityGate[];
  responseProtocol: ResponseProtocol;
  communicationStyle: CommunicationStyle;
  thinkingProtocol: ThinkingProtocol;
  decisionFramework: DecisionFramework;
  triggers: TriggerRule[];
  /** TABOO ＝ このユーザーが絶対に言わないこと・取らない振る舞い。 */
  taboos: Rule[];
  examples: ExampleCase[];
}

/** ターゲット AI ごとに最適化した Markdown 出力の種類。 */
export type ExportTarget =
  | "chatgpt"
  | "claude"
  | "claude_code"
  | "gemini"
  | "google_antigravity"
  | "cursor"
  | "universal_agent";

export interface ExportedPrompt {
  target: ExportTarget;
  filename: string;
  markdown: string;
}
