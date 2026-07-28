import { NextResponse } from "next/server";
import { trackMdComplete } from "@/lib/analytics/track-server";
import {
  extractProtocols,
  extractProtocolsStub,
} from "@/lib/gemini/extract-protocols";
import { renderAllTargets } from "@/lib/markdown/render-executable";
import type { GenerateContextRequest } from "@/types/gemini";

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

/**
 * POST /api/generate-context
 *
 * 入力データから ExecutableContext (中間 JSON) を生成し、
 * 4 ターゲット分の Markdown も同時に返す。
 *
 * GEMINI_API_KEY が未設定 or `?stub=1` クエリ付きの場合は
 * 決定論的なスタブ抽出器を使う（M1 動作確認用）。
 */
export async function POST(request: Request) {
  let body: GenerateContextRequest;
  try {
    body = (await request.json()) as GenerateContextRequest;
  } catch {
    return NextResponse.json(
      { error: "リクエストボディが JSON ではありません" },
      { status: 400 },
    );
  }

  if (!body?.profile?.role) {
    return NextResponse.json(
      { error: "profile.role が必須です" },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const useStub = url.searchParams.get("stub") === "1" || !process.env.GEMINI_API_KEY;

  try {
    const context = useStub
      ? extractProtocolsStub(body)
      : await extractProtocols(body);

    const exports = renderAllTargets(context);

    const mode = useStub ? "stub" : "gemini";
    await trackMdComplete(request, mode);

    return NextResponse.json({
      mode,
      context,
      exports,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Gemini の quota 超過時は、入力を失わず作業継続できるよう
    // 決定論的スタブ生成へ自動フォールバックする。
    if (!useStub && isQuotaError(message)) {
      const context = extractProtocolsStub(body);
      const exports = renderAllTargets(context);
      await trackMdComplete(request, "stub_due_to_quota");
      return NextResponse.json({
        mode: "stub_due_to_quota",
        warning:
          "Gemini API の利用枠を超過したため、スタブ抽出で生成しました。quota 回復後に再生成してください。",
        context,
        exports,
      });
    }

    return NextResponse.json(
      { error: `Context 生成に失敗しました: ${message}` },
      { status: 500 },
    );
  }
}
