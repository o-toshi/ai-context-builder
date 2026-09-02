const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const MAX_TRACKED_CLIENTS = 10_000;

interface ClientRateLimitEntry {
  timestamps: number[];
  lastSeenAt: number;
}

export interface PublisherRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

const clientEntries = new Map<string, ClientRateLimitEntry>();

function removeExpiredEntries(now: number): void {
  const expiresBefore = now - RATE_LIMIT_WINDOW_MS;
  for (const [key, entry] of clientEntries) {
    if (entry.lastSeenAt <= expiresBefore) clientEntries.delete(key);
  }
}

function makeRoomForClient(now: number): void {
  if (clientEntries.size < MAX_TRACKED_CLIENTS) return;
  removeExpiredEntries(now);
  if (clientEntries.size < MAX_TRACKED_CLIENTS) return;

  let oldestKey: string | undefined;
  let oldestSeenAt = Number.POSITIVE_INFINITY;
  for (const [key, entry] of clientEntries) {
    if (entry.lastSeenAt < oldestSeenAt) {
      oldestKey = key;
      oldestSeenAt = entry.lastSeenAt;
    }
  }
  if (oldestKey) clientEntries.delete(oldestKey);
}

function firstForwardedAddress(value: string | null): string | null {
  const address = value?.split(",")[0]?.trim();
  return address || null;
}

/** Vercel等の信頼済みプロキシが付与する接続元情報を優先する。 */
export function getPublisherClientKey(request: Request): string {
  const address =
    firstForwardedAddress(request.headers.get("x-vercel-forwarded-for")) ??
    firstForwardedAddress(request.headers.get("x-forwarded-for")) ??
    request.headers.get("x-real-ip")?.trim();
  if (address) return `ip:${address}`;

  // ローカル開発等でIPヘッダーがない場合も、全利用者を1枠にまとめない。
  const userAgent = request.headers.get("user-agent")?.slice(0, 160) ?? "unknown";
  return `anonymous:${userAgent}`;
}

/** 1インスタンス内で、接続元ごとに直近1分5回まで許可する。 */
export function consumePublisherRateLimit(
  clientKey: string,
  now = Date.now(),
): PublisherRateLimitResult {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const existing = clientEntries.get(clientKey);
  const timestamps = existing
    ? existing.timestamps.filter((timestamp) => timestamp > windowStart)
    : [];

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const resetAt = timestamps[0] + RATE_LIMIT_WINDOW_MS;
    clientEntries.set(clientKey, { timestamps, lastSeenAt: now });
    return {
      allowed: false,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: 0,
      resetAt,
      retryAfterMs: Math.max(1, resetAt - now),
    };
  }

  if (!existing) makeRoomForClient(now);
  timestamps.push(now);
  const resetAt = timestamps[0] + RATE_LIMIT_WINDOW_MS;
  clientEntries.set(clientKey, { timestamps, lastSeenAt: now });

  return {
    allowed: true,
    limit: RATE_LIMIT_MAX_REQUESTS,
    remaining: RATE_LIMIT_MAX_REQUESTS - timestamps.length,
    resetAt,
  };
}

export function publisherRateLimitHeaders(
  result: PublisherRateLimitResult,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1_000)),
  };
  if (result.retryAfterMs) {
    headers["Retry-After"] = String(Math.ceil(result.retryAfterMs / 1_000));
  }
  return headers;
}
