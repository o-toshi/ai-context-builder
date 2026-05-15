import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/gemini/transcribe";
import type { TranscribeRequest } from "@/types/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/transcribe
 *
 * 音声 (base64) を Gemini Audio に渡して、文字起こし＋プロソディを取得する。
 * GEMINI_API_KEY が未設定の場合はダミーの文字起こしを返す（M1 動作確認用）。
 */
export async function POST(request: Request) {
  let body: TranscribeRequest;
  try {
    body = (await request.json()) as TranscribeRequest;
  } catch {
    return NextResponse.json(
      { error: "リクエストボディが JSON ではありません" },
      { status: 400 },
    );
  }

  if (!body?.audioBase64 || !body?.mimeType) {
    return NextResponse.json(
      { error: "audioBase64 と mimeType は必須です" },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({
      mode: "stub",
      transcript:
        "[stub] GEMINI_API_KEY が未設定のためダミー文字起こしを返しています。",
      prosody: {
        tone: "落ち着いた断定調",
        pace: "normal",
        confidence: "mid",
        note: "stub 出力",
      },
    });
  }

  try {
    const result = await transcribeAudio(body);
    return NextResponse.json({ mode: "gemini", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `文字起こしに失敗しました: ${message}` },
      { status: 500 },
    );
  }
}
