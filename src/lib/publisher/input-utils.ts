const HASHTAG_SEPARATOR = /[\s,，、]+/u;
const URL_PATTERN =
  /https?:\/\/[^\s<>"'`、。，．！？；：「」『』【】〈〉《》]+/giu;
const TRAILING_URL_PUNCTUATION = /[.,!?;:、。，．！？；：」』】〉》]+$/u;
const HASHTAG_IN_TEXT_PATTERN = /[#＃]([\p{L}\p{N}\p{M}_]+)/gu;

/**
 * カンマ・空白・日本語の読点で区切り、先頭の # を外して重複を除く。
 * 大文字小文字だけが異なるタグは同じものとして扱い、最初の表記を残す。
 */
export function normalizeHashtags(
  input: string | readonly string[],
): string[] {
  const sources = typeof input === "string" ? [input] : input;
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    for (const token of source.split(HASHTAG_SEPARATOR)) {
      const hashtag = token.trim().replace(/^#+/u, "");
      if (!hashtag) continue;

      const key = hashtag.toLocaleLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      normalized.push(hashtag);
    }
  }

  return normalized;
}

function stripUnbalancedClosingCharacter(
  value: string,
  opening: string,
  closing: string,
): string {
  let result = value;
  const count = (text: string, character: string) =>
    Array.from(text).filter((item) => item === character).length;

  while (
    result.endsWith(closing) &&
    count(result, closing) > count(result, opening)
  ) {
    result = result.slice(0, -closing.length);
  }

  return result;
}

function cleanUrlCandidate(candidate: string): string {
  let value = candidate.replace(TRAILING_URL_PUNCTUATION, "");
  value = stripUnbalancedClosingCharacter(value, "(", ")");
  value = stripUnbalancedClosingCharacter(value, "[", "]");
  value = stripUnbalancedClosingCharacter(value, "{", "}");
  return value;
}

/** メッセージ内のHTTP(S) URLを、出現順を保って重複なく抽出する。 */
export function extractUrls(message: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const match of message.matchAll(URL_PATTERN)) {
    const candidate = cleanUrlCandidate(match[0]);
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        continue;
      }

      const key = parsed.href;
      if (seen.has(key)) continue;

      seen.add(key);
      urls.push(candidate);
    } catch {
      // URLとして解釈できない文字列は入力本文に残し、抽出結果からだけ除外する。
    }
  }

  return urls;
}

/** URLフラグメントを除外し、投稿本文に実際に書かれたハッシュタグを抽出する。 */
export function extractHashtagsFromText(text: string): string[] {
  let textWithoutUrls = text;
  for (const url of extractUrls(text)) {
    textWithoutUrls = textWithoutUrls.replaceAll(url, " ");
  }

  return normalizeHashtags(
    Array.from(textWithoutUrls.matchAll(HASHTAG_IN_TEXT_PATTERN), (match) =>
      match[1],
    ),
  );
}

/** SNS公式の課金文字数ではなく、Unicodeコードポイント単位の表示用概算。 */
export function countPublisherCharacters(text: string): number {
  return Array.from(text).length;
}
