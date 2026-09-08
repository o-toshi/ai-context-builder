export type PublisherInputKind = "keywords" | "draft";

const SENTENCE_END_PATTERN = /[。！？!?]/u;
const DRAFT_PREDICATE_PATTERN =
  /(?:です|ます|でした|ました|だった|である|している|していた|してる|した|する|始める|始まる|始動する|考える|考えている|思う|思っている|感じる|感じた|気付いた|気づいた|疲れた|美味しい|美味しかった|楽しい|楽しかった|予定(?:です)?|したい|してほしい)$/u;
const RELATIONAL_EXPRESSION_PATTERN =
  /(?:について|として|だから|けれど|しかし|そして|[はがをにでへと]の?)/u;
const KEYWORD_SEPARATOR_PATTERN = /[\n\r,、]+/u;
const WHITESPACE_PATTERN = /[\t ]+/u;

function splitMaterials(message: string, pattern: RegExp): string[] {
  return message
    .split(pattern)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * UIで選択を求めず、入力の表面構造だけから生成方針を決める。
 * 判定は事実推定には使わず、文章化するか再構成するかの指示にだけ使う。
 */
export function detectPublisherInputKind(message: string): PublisherInputKind {
  const normalized = message.trim();
  if (!normalized) return "draft";

  if (SENTENCE_END_PATTERN.test(normalized)) return "draft";
  if (DRAFT_PREDICATE_PATTERN.test(normalized)) return "draft";

  const separatedMaterials = splitMaterials(
    normalized,
    KEYWORD_SEPARATOR_PATTERN,
  );
  if (
    separatedMaterials.length >= 2 &&
    separatedMaterials.every((material) => material.length <= 40)
  ) {
    return "keywords";
  }

  const whitespaceMaterials = splitMaterials(normalized, WHITESPACE_PATTERN);
  if (
    whitespaceMaterials.length >= 2 &&
    whitespaceMaterials.every((material) => material.length <= 24)
  ) {
    return "keywords";
  }

  if (
    normalized.length <= 24 &&
    !RELATIONAL_EXPRESSION_PATTERN.test(normalized)
  ) {
    return "keywords";
  }

  return "draft";
}

/** keywords判定時に、AIへ独立した素材として明示するための分割結果を返す。 */
export function extractPublisherInputMaterials(message: string): string[] {
  const normalized = message.trim();
  if (!normalized) return [];

  const separatedMaterials = splitMaterials(
    normalized,
    KEYWORD_SEPARATOR_PATTERN,
  );
  if (separatedMaterials.length >= 2) return separatedMaterials;

  const whitespaceMaterials = splitMaterials(normalized, WHITESPACE_PATTERN);
  return whitespaceMaterials.length >= 2
    ? whitespaceMaterials
    : [normalized];
}
