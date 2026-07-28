import { track } from "@vercel/analytics/server";
import { ANALYTICS_EVENTS } from "./events";

/** Markdown 生成完了（MD生成完了数）— API ルートから送信 */
export async function trackMdComplete(
  request: Request,
  mode: string,
): Promise<void> {
  try {
    await track(ANALYTICS_EVENTS.mdComplete, { mode }, { request });
  } catch (err) {
    console.error("[analytics] md_complete failed:", err);
  }
}
