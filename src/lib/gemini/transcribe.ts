import { getGemini, MODELS } from "./client";
import { TRANSCRIBE_SYSTEM_INSTRUCTION } from "./prompts";
import type { TranscribeRequest, TranscribeResponse } from "@/types/gemini";

/**
 * 音声 → 文字起こし＋プロソディ抽出。
 *
 * Gemini Audio Input は inline_data (base64) を直接受け取れる。
 * MVP は max ~20MB を想定し、より長い音声は将来 File API へ移行する。
 */
export async function transcribeAudio(
  req: TranscribeRequest,
): Promise<TranscribeResponse> {
  const genai = getGemini();
  const model = genai.getGenerativeModel({
    model: MODELS.audio(),
    systemInstruction: TRANSCRIBE_SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: req.mimeType,
        data: req.audioBase64,
      },
    },
    {
      text: req.questionPrompt
        ? `元になった質問: ${req.questionPrompt}\nこの質問への回答として上の音声を文字起こしし、プロソディも記述してください。`
        : "上記の音声を文字起こしし、プロソディも記述してください。",
    },
  ]);

  const text = result.response.text();
  try {
    const parsed = JSON.parse(text) as TranscribeResponse;
    return parsed;
  } catch (err) {
    throw new Error(
      `Gemini からの文字起こし応答を JSON としてパースできませんでした: ${(err as Error).message}\n生応答: ${text.slice(0, 500)}`,
    );
  }
}
