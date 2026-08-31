import { extractUrls } from "@/lib/publisher/input-utils";
import type { PostInput, PublisherPlatform } from "@/types/publisher";

export type PublisherInputInsufficientReason = "NOTE_SOURCE_NOT_CONFIRMED";

export class PublisherInputInsufficientError extends Error {
  readonly reasonCode: PublisherInputInsufficientReason;
  readonly affectedPlatforms: readonly PublisherPlatform[];

  constructor(
    message: string,
    reasonCode: PublisherInputInsufficientReason,
    affectedPlatforms: readonly PublisherPlatform[],
  ) {
    super(message);
    this.name = "PublisherInputInsufficientError";
    this.reasonCode = reasonCode;
    this.affectedPlatforms = affectedPlatforms;
  }
}

const EXPLICIT_NOTE_ARTICLE_PATTERNS = [
  /note\s*(?:の)?記事/iu,
  /note\s*告知/iu,
  /note(?:で|に).{0,80}(?:記事|公開|投稿|掲載|執筆|告知|紹介|書(?:く|いた|きました|いている))/iu,
  /note(?:を|の).{0,40}(?:公開|投稿|掲載|執筆|告知|紹介|更新)/iu,
];

const ARTICLE_ANNOUNCEMENT_PATTERN =
  /(?:(?:記事|コラム|エッセイ).{0,80}(?:公開|投稿|掲載|告知|紹介|書(?:いた|きました|いている))|(?:公開|投稿|掲載|告知|紹介).{0,80}(?:記事|コラム|エッセイ))/iu;

function isNoteUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLocaleLowerCase();
    return hostname === "note.com" || hostname.endsWith(".note.com");
  } catch {
    return false;
  }
}

/** URL先は取得せず、入力本文だけからnote記事・記事告知の根拠を判定する。 */
export function hasNoteAnnouncementEvidence(message: string): boolean {
  const urls = extractUrls(message);
  if (urls.some(isNoteUrl)) return true;
  if (EXPLICIT_NOTE_ARTICLE_PATTERNS.some((pattern) => pattern.test(message))) {
    return true;
  }

  return urls.length > 0 && ARTICLE_ANNOUNCEMENT_PATTERN.test(message);
}

/** v1.0では確認質問を返さず、note告知の根拠不足を明示的な失敗にする。 */
export function assertPublisherInputSufficient(input: PostInput): void {
  if (
    !input.platforms.includes("note") ||
    hasNoteAnnouncementEvidence(input.message)
  ) {
    return;
  }

  throw new PublisherInputInsufficientError(
    "note告知を作るには、告知したいnote記事または記事URLを「伝えたいこと」に含めてください。",
    "NOTE_SOURCE_NOT_CONFIRMED",
    ["note"],
  );
}
