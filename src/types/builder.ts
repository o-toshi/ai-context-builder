/**
 * Builder（診断ウィザード）の入力値とステップ進行に関する型。
 * Zustand store のシェイプもここで規定する。
 */

import type { ExecutableContext, UserProfile } from "./executable-context";

export type StepId =
  | "onboarding"
  | "personality"
  | "interview"
  | "scenarios"
  | "generate"
  | "result";

export interface StepDefinition {
  id: StepId;
  label: string;
  description: string;
  /** ステップ番号（1始まり、ランディングと結果ページは含めない）。 */
  index: number;
  /** ナビゲーション用パス。 */
  path: string;
}

/** 性格診断 / プロトコル抽出特化設問の回答（Likert 5 段階等）。 */
export interface PersonalityAnswer {
  questionId: string;
  /** 1〜5 の整数。中立は 3。 */
  value: number;
}

/** 音声インタビューの 1 質問あたりの記録。 */
export interface InterviewClip {
  questionId: string;
  /** 録音された音声を base64 で保持（MVP の localStorage 永続化用）。 */
  audioBase64?: string;
  /** MIME タイプ（例: "audio/webm"）。 */
  mimeType?: string;
  /** Gemini で文字起こしされたテキスト。 */
  transcript?: string;
  /** Gemini が抽出した非言語特徴（声のトーン・話速・断定度など）。 */
  prosody?: {
    tone?: string;
    pace?: "slow" | "normal" | "fast";
    confidence?: "low" | "mid" | "high";
    note?: string;
  };
  /** 録音時間（秒）。 */
  durationSec?: number;
}

/** シナリオテストの回答。 */
export interface ScenarioAnswer {
  scenarioId: string;
  /** 自由記述（第一声）。 */
  freeText?: string;
  /** 補助の選択肢（例: "即返信" / "翌朝対応" / "未定"）。 */
  choice?: string;
}

export interface BuilderInput {
  profile: Partial<UserProfile>;
  personalityAnswers: PersonalityAnswer[];
  interviewClips: InterviewClip[];
  scenarioAnswers: ScenarioAnswer[];
}

export interface BuilderProgress {
  currentStep: StepId;
  completed: Record<StepId, boolean>;
  startedAt?: string;
  updatedAt?: string;
}

/** Zustand に格納する全状態。 */
export interface BuilderState {
  input: BuilderInput;
  progress: BuilderProgress;
  /** Gemini で生成された中間 JSON。 */
  context?: ExecutableContext;
  /** 編集済みの上書き（中間 JSON のフィールド単位の手動修正）。 */
  contextOverrides?: Partial<ExecutableContext>;
  /** 最終出力 Markdown（target → markdown）。 */
  exports?: Record<string, string>;
}
