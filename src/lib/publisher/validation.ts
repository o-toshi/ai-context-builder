import { PUBLISHER_PLATFORMS } from "@/data/publisher-options";
import {
  extractHashtagsFromText,
  normalizeHashtags,
} from "@/lib/publisher/input-utils";
import type {
  GeneratedPostDraft,
  PublisherPlatform,
} from "@/types/publisher";

const VALID_PLATFORMS = new Set<string>(
  PUBLISHER_PLATFORMS.map((option) => option.value),
);

export class PublisherResponseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublisherResponseValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublisherPlatform(value: unknown): value is PublisherPlatform {
  return typeof value === "string" && VALID_PLATFORMS.has(value);
}

export function assertRequestedPlatforms(
  platforms: readonly PublisherPlatform[],
): void {
  if (platforms.length === 0) {
    throw new PublisherResponseValidationError(
      "投稿先SNSが1件も選択されていません。",
    );
  }

  const seen = new Set<string>();
  for (const platform of platforms) {
    if (!isPublisherPlatform(platform)) {
      throw new PublisherResponseValidationError(
        `未対応の投稿先SNSが指定されています: ${String(platform)}`,
      );
    }
    if (seen.has(platform)) {
      throw new PublisherResponseValidationError(
        `投稿先SNSが重複しています: ${platform}`,
      );
    }
    seen.add(platform);
  }
}

/**
 * AI応答を実行時に検証し、選択SNSと完全一致する投稿案だけを返す。
 * 不足・重複・選択外SNS・空本文・不正なハッシュタグ構造はすべて拒否する。
 */
export function validateGeneratedPostResponse(
  data: unknown,
  requestedPlatforms: readonly PublisherPlatform[],
  allowedHashtags: readonly string[],
): GeneratedPostDraft[] {
  assertRequestedPlatforms(requestedPlatforms);

  if (!isRecord(data) || !Array.isArray(data.posts)) {
    throw new PublisherResponseValidationError(
      "AI応答にposts配列がありません。",
    );
  }

  const requested = new Set<PublisherPlatform>(requestedPlatforms);
  const allowedHashtagByKey = new Map(
    normalizeHashtags(allowedHashtags).map((tag) => [
      tag.toLocaleLowerCase(),
      tag,
    ]),
  );
  const postsByPlatform = new Map<PublisherPlatform, GeneratedPostDraft>();

  for (const [index, rawPost] of data.posts.entries()) {
    if (!isRecord(rawPost)) {
      throw new PublisherResponseValidationError(
        `posts[${index}] がオブジェクトではありません。`,
      );
    }

    const platform = rawPost.platform;
    if (!isPublisherPlatform(platform)) {
      throw new PublisherResponseValidationError(
        `posts[${index}].platform が不正です。`,
      );
    }
    if (!requested.has(platform)) {
      throw new PublisherResponseValidationError(
        `選択されていないSNSの投稿案が含まれています: ${platform}`,
      );
    }
    if (postsByPlatform.has(platform)) {
      throw new PublisherResponseValidationError(
        `同じSNSの投稿案が重複しています: ${platform}`,
      );
    }

    if (typeof rawPost.text !== "string" || !rawPost.text.trim()) {
      throw new PublisherResponseValidationError(
        `${platform} の投稿本文が空です。`,
      );
    }
    if (
      !Array.isArray(rawPost.hashtags) ||
      !rawPost.hashtags.every((tag) => typeof tag === "string")
    ) {
      throw new PublisherResponseValidationError(
        `${platform} のhashtagsが文字列配列ではありません。`,
      );
    }

    const reportedHashtags = normalizeHashtags(rawPost.hashtags);
    const textHashtags = extractHashtagsFromText(rawPost.text);
    const unexpectedTextHashtags = textHashtags.filter(
      (tag) => !allowedHashtagByKey.has(tag.toLocaleLowerCase()),
    );
    if (unexpectedTextHashtags.length > 0) {
      throw new PublisherResponseValidationError(
        `${platform} の本文に入力されていないハッシュタグが含まれています: ${unexpectedTextHashtags.join(
          ", ",
        )}`,
      );
    }

    const textHashtagKeys = new Set(
      textHashtags.map((tag) => tag.toLocaleLowerCase()),
    );
    const hashtags = reportedHashtags
      .map((tag) => allowedHashtagByKey.get(tag.toLocaleLowerCase()))
      .filter((tag): tag is string => Boolean(tag))
      .filter((tag) => textHashtagKeys.has(tag.toLocaleLowerCase()));

    for (const textHashtag of textHashtags) {
      const canonicalTag = allowedHashtagByKey.get(
        textHashtag.toLocaleLowerCase(),
      );
      if (
        canonicalTag &&
        !hashtags.some(
          (tag) =>
            tag.toLocaleLowerCase() === canonicalTag.toLocaleLowerCase(),
        )
      ) {
        hashtags.push(canonicalTag);
      }
    }

    postsByPlatform.set(platform, {
      platform,
      text: rawPost.text.trim(),
      hashtags,
    });
  }

  const missingPlatforms = requestedPlatforms.filter(
    (platform) => !postsByPlatform.has(platform),
  );
  if (missingPlatforms.length > 0) {
    throw new PublisherResponseValidationError(
      `投稿案が不足しています: ${missingPlatforms.join(", ")}`,
    );
  }

  if (postsByPlatform.size !== requestedPlatforms.length) {
    throw new PublisherResponseValidationError(
      "AI応答の投稿案数が選択SNS数と一致しません。",
    );
  }

  return requestedPlatforms.map((platform) => postsByPlatform.get(platform)!);
}
