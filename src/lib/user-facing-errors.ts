/** API の HTTP 失敗をユーザー向けの短文に寄せる */
export function formatHttpError(status: number, bodyMessage: string): string {
  const raw = bodyMessage.trim();
  const lower = raw.toLowerCase();
  if (status === 401 || status === 403) {
    return "API キーが無効か、利用権限がありません。.env の GEMINI_API_KEY を確認してください。";
  }
  if (status === 400) {
    return raw || "入力データの形式が正しくありません。前のステップの入力を確認してください。";
  }
  if (status === 429) {
    return "リクエストが集中しています。数十秒〜数分待ってから再試行してください。";
  }
  if (status >= 502) {
    return "サーバー側の一時不調の可能性があります。しばらくしてから再試行してください。";
  }
  if (
    lower.includes("api key") ||
    lower.includes("api_key") ||
    lower.includes("invalid api")
  ) {
    return `API キー関連のエラーです。GEMINI_API_KEY とモデル設定を確認してください。\n詳細: ${raw}`;
  }
  return raw || `エラー (HTTP ${status.toString()})`;
}

/** fetch 例外・不透明なエラーを短文に寄せる */
export function formatClientFetchError(err: unknown): string {
  if (!(err instanceof Error)) return "不明なエラー";
  const msg = err.message;
  const lower = msg.toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed")
  ) {
    return "ネットワークに接続できませんでした。接続を確認してから再試行してください。";
  }
  return msg;
}
