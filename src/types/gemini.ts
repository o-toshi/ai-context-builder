/**
 * Gemini API 呼び出しに関する補助型。
 */

export interface GenerateContextRequest {
  profile: {
    displayName?: string;
    role: string;
    industry: string;
    teamSize: string;
  };
  personality: Array<{ questionId: string; prompt: string; value: number }>;
  interview: Array<{
    questionId: string;
    prompt: string;
    transcript?: string;
    prosodyNote?: string;
  }>;
  scenarios: Array<{
    scenarioId: string;
    prompt: string;
    freeText?: string;
    choice?: string;
  }>;
}

export interface TestChatRequest {
  systemPrompt: string;
  history: Array<{ role: "user" | "model"; text: string }>;
  message: string;
}

export interface TranscribeRequest {
  /** data URL もしくは base64。MVP は base64 を直接受ける。 */
  audioBase64: string;
  mimeType: string;
  questionPrompt?: string;
}

export interface TranscribeResponse {
  transcript: string;
  prosody: {
    tone?: string;
    pace?: "slow" | "normal" | "fast";
    confidence?: "low" | "mid" | "high";
    note?: string;
  };
}
