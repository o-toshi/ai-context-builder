import {
  PUBLISHER_EMOTIONS,
  PUBLISHER_PLATFORMS,
  PUBLISHER_PURPOSES,
} from "@/data/publisher-options";
import {
  extractUrls,
  normalizeHashtags,
} from "@/lib/publisher/input-utils";
import type {
  GeneratePostsRequest,
  PublisherEmotion,
  PublisherGenerationContext,
  PublisherPlatform,
  PublisherPurpose,
} from "@/types/publisher";

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_HASHTAGS = 20;
const MAX_HASHTAG_LENGTH = 64;
const MAX_CONTEXT_TEXT_LENGTH = 2_000;
const MAX_CONTEXT_ITEMS = 20;
const MAX_CONTEXT_ITEM_LENGTH = 500;

const VALID_EMOTIONS = new Set<string>(
  PUBLISHER_EMOTIONS.map((option) => option.value),
);
const VALID_PURPOSES = new Set<string>(
  PUBLISHER_PURPOSES.map((option) => option.value),
);
const VALID_PLATFORMS = new Set<string>(
  PUBLISHER_PLATFORMS.map((option) => option.value),
);

export class PublisherRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublisherRequestValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new PublisherRequestValidationError(`${field}は必須です。`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new PublisherRequestValidationError(
      `${field}は${maxLength}文字以内で入力してください。`,
    );
  }
  return normalized;
}

function optionalString(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredString(value, field, maxLength);
}

function optionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new PublisherRequestValidationError(
      `${field}は文字列配列で指定してください。`,
    );
  }
  if (value.length > MAX_CONTEXT_ITEMS) {
    throw new PublisherRequestValidationError(
      `${field}は${MAX_CONTEXT_ITEMS}件以内で指定してください。`,
    );
  }
  return value.map((item, index) =>
    requiredString(
      item,
      `${field}[${index}]`,
      MAX_CONTEXT_ITEM_LENGTH,
    ),
  );
}

function parseContext(value: unknown): PublisherGenerationContext | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    throw new PublisherRequestValidationError(
      "contextはオブジェクトで指定してください。",
    );
  }

  return {
    writingStyle: optionalString(
      value.writingStyle,
      "context.writingStyle",
      MAX_CONTEXT_TEXT_LENGTH,
    ),
    decisionPrinciples: optionalStringArray(
      value.decisionPrinciples,
      "context.decisionPrinciples",
    ),
    values: optionalStringArray(value.values, "context.values"),
    communicationStyle: optionalString(
      value.communicationStyle,
      "context.communicationStyle",
      MAX_CONTEXT_TEXT_LENGTH,
    ),
  };
}

/** 外部入力を信用せず、生成ユースケースへ渡す型へ再構築する。 */
export function parseGeneratePostsRequest(body: unknown): GeneratePostsRequest {
  if (!isRecord(body) || !isRecord(body.input)) {
    throw new PublisherRequestValidationError(
      "inputオブジェクトが必要です。",
    );
  }

  const raw = body.input;
  const id = requiredString(raw.id, "input.id", 128);
  if (raw.mode !== "life") {
    throw new PublisherRequestValidationError(
      "v1.0で利用できるmodeはlifeのみです。",
    );
  }

  const message = requiredString(
    raw.message,
    "input.message",
    MAX_MESSAGE_LENGTH,
  );
  if (typeof raw.emotion !== "string" || !VALID_EMOTIONS.has(raw.emotion)) {
    throw new PublisherRequestValidationError(
      "input.emotionが未指定または不正です。",
    );
  }
  if (typeof raw.purpose !== "string" || !VALID_PURPOSES.has(raw.purpose)) {
    throw new PublisherRequestValidationError(
      "input.purposeが未指定または不正です。",
    );
  }

  if (
    !Array.isArray(raw.hashtags) ||
    !raw.hashtags.every((tag) => typeof tag === "string")
  ) {
    throw new PublisherRequestValidationError(
      "input.hashtagsは文字列配列で指定してください。",
    );
  }
  const hashtags = normalizeHashtags(raw.hashtags);
  if (hashtags.length > MAX_HASHTAGS) {
    throw new PublisherRequestValidationError(
      `ハッシュタグは${MAX_HASHTAGS}件以内で指定してください。`,
    );
  }
  if (hashtags.some((tag) => tag.length > MAX_HASHTAG_LENGTH)) {
    throw new PublisherRequestValidationError(
      `ハッシュタグは1件${MAX_HASHTAG_LENGTH}文字以内で指定してください。`,
    );
  }

  if (
    !Array.isArray(raw.platforms) ||
    raw.platforms.length === 0 ||
    !raw.platforms.every(
      (platform) =>
        typeof platform === "string" && VALID_PLATFORMS.has(platform),
    )
  ) {
    throw new PublisherRequestValidationError(
      "input.platformsに対応SNSを1件以上指定してください。",
    );
  }
  const platforms = raw.platforms as PublisherPlatform[];
  if (new Set(platforms).size !== platforms.length) {
    throw new PublisherRequestValidationError(
      "input.platformsに重複があります。",
    );
  }

  const createdAt = requiredString(raw.createdAt, "input.createdAt", 64);
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new PublisherRequestValidationError(
      "input.createdAtは有効な日時ではありません。",
    );
  }

  return {
    input: {
      id,
      mode: "life",
      message,
      emotion: raw.emotion as PublisherEmotion,
      purpose: raw.purpose as PublisherPurpose,
      hashtags,
      platforms,
      // クライアント値を信用せず、検証済みmessageから再抽出する。
      sourceUrls: extractUrls(message),
      createdAt,
    },
    context: parseContext(body.context),
  };
}
