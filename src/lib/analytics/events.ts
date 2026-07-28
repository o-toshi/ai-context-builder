/** Vercel Analytics のカスタムイベント名（ダッシュボード → Events で確認） */
export const ANALYTICS_EVENTS = {
  /** オンボーディング送信（フロー開始） */
  flowStart: "acb_flow_start",
  /** Markdown 生成完了 */
  mdComplete: "acb_md_complete",
} as const;

/** 訪問者数は Web Analytics のページビュー `/` で確認 */
