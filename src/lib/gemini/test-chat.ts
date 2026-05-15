import { getGemini, MODELS } from "./client";
import type { TestChatRequest } from "@/types/gemini";

const RETRYABLE_STATUSES = ["429", "500", "502", "503", "504"];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_STATUSES.some((code) => message.includes(code));
}

/**
 * 生成された system prompt をその場で試すチャット。
 * 「テスト実行」機能のバックエンド。
 */
export async function runTestChat(
  req: TestChatRequest,
): Promise<{ reply: string }> {
  const modelCandidates = [MODELS.chat(), process.env.GEMINI_CHAT_FALLBACK_MODEL]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i) as string[];

  let lastError: unknown;
  for (const modelName of modelCandidates) {
    const genai = getGemini();
    const model = genai.getGenerativeModel({
      model: modelName,
      systemInstruction: req.systemPrompt,
      generationConfig: {
        temperature: 0.7,
      },
    });

    const chat = model.startChat({
      history: req.history.map((h) => ({
        role: h.role,
        parts: [{ text: h.text }],
      })),
    });

    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await chat.sendMessage(req.message);
        return { reply: result.response.text() };
      } catch (error) {
        lastError = error;
        if (!isRetryableGeminiError(error) || attempt === maxAttempts) {
          break;
        }
        const waitMs = 800 * 2 ** (attempt - 1);
        await sleep(waitMs);
      }
    }
  }

  throw lastError ?? new Error("テスト実行の Gemini 呼び出しに失敗しました");
}
