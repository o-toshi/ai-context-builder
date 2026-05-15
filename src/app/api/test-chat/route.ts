import { NextResponse } from "next/server";
import { runTestChat } from "@/lib/gemini/test-chat";
import type { TestChatRequest } from "@/types/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

function isQuotaError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("quota exceeded") ||
    lower.includes("too many requests") ||
    lower.includes("rate limit") ||
    lower.includes("429")
  );
}

function buildStubReplyFromUserMessage(message: string): string {
  return [
    "[stub_due_to_quota] Gemini API の利用枠超過のため、テスト実行をスタブ応答で返しています。",
    "結論: API枠の回復後に再実行してください。",
    "根拠: 現在は 429 (Too Many Requests / Quota Exceeded) が発生しています。",
    "次アクション: AI Studio / GCP で quota・課金設定を確認するか、時間を置いて再試行してください。",
    "",
    `受け取ったメッセージ: ${message}`,
  ].join("\n");
}

/**
 * POST /api/test-chat
 *
 * 生成した system prompt をその場で試すチャット機能のバックエンド。
 */
export async function POST(request: Request) {
  let body: TestChatRequest;
  try {
    body = (await request.json()) as TestChatRequest;
  } catch {
    return NextResponse.json(
      { error: "リクエストボディが JSON ではありません" },
      { status: 400 },
    );
  }

  if (!body?.systemPrompt || !body?.message) {
    return NextResponse.json(
      { error: "systemPrompt と message は必須です" },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({
      mode: "stub",
      reply:
        "[stub] AIキー（環境変数: GEMINI_API_KEY）が未設定のためダミー応答を返しています。\n生成された system prompt の構造は OK です。.env.local に GEMINI_API_KEY を設定すると、実際の応答が返ります。",
    });
  }

  try {
    const { reply } = await runTestChat(body);
    return NextResponse.json({ mode: "gemini", reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // 429 / quota 超過時は、UX を止めないようスタブでフォールバックする
    if (isQuotaError(message)) {
      return NextResponse.json({
        mode: "stub_due_to_quota",
        warning:
          "Gemini API の利用枠を超過しているため、スタブ応答を返しました。quota 回復後に再実行してください。",
        reply: buildStubReplyFromUserMessage(body.message),
      });
    }

    return NextResponse.json(
      { error: `テスト実行に失敗しました: ${message}` },
      { status: 500 },
    );
  }
}
