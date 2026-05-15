import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini クライアントの遅延初期化。
 *
 * server-only でしか呼ばれない想定。API ルートからのみ import すること。
 */

let cached: GoogleGenerativeAI | null = null;

export function getGemini(): GoogleGenerativeAI {
  if (cached) return cached;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY が未設定です。.env.local を作成し API キーを設定してください。",
    );
  }
  cached = new GoogleGenerativeAI(apiKey);
  return cached;
}

export const MODELS = {
  text: () => process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash",
  audio: () => process.env.GEMINI_AUDIO_MODEL ?? "gemini-2.5-flash",
  chat: () => process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash",
};
