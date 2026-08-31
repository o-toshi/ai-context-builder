import { getGemini, MODELS } from "@/lib/gemini/client";
import {
  buildPublisherGenerationPrompt,
  HUE_PUBLISHER_SYSTEM_INSTRUCTION,
} from "@/lib/publisher/prompts";
import { PUBLISHER_POSTS_RESPONSE_SCHEMA } from "@/lib/publisher/schema";
import type {
  PostGenerationExecutionOptions,
  PostGenerationProvider,
  PostGenerationProviderOutput,
} from "@/lib/publisher/providers/post-generation-provider";
import type { GeneratePostsRequest } from "@/types/publisher";

const RETRYABLE_STATUSES = ["429", "500", "502", "503", "504"];
const DEFAULT_FALLBACK_MODEL = "gemini-2.0-flash";
const DEFAULT_TOTAL_TIMEOUT_MS = 24_000;
const DEFAULT_MAX_ATTEMPTS_PER_MODEL = 2;
const MAX_ATTEMPTS_PER_MODEL = 4;
const MAX_FALLBACK_RESERVE_MS = 8_000;
const MIN_REQUEST_BUDGET_MS = 1_000;
const POLICY_FINISH_REASONS = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
]);

type GeminiResponseLike = {
  promptFeedback?: { blockReason?: unknown };
  candidates?: Array<{ finishReason?: unknown }>;
  text: () => string;
};

export class PublisherPolicyRefusalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublisherPolicyRefusalError";
  }
}

export class PublisherInvalidJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublisherInvalidJsonError";
  }
}

export class PublisherGenerationTimeoutError extends Error {
  constructor(message = "投稿案生成の処理時間が上限に達しました。") {
    super(message);
    this.name = "PublisherGenerationTimeoutError";
  }
}

export class PublisherModelsExhaustedError extends Error {
  readonly primaryError: unknown;
  readonly fallbackError: unknown;

  constructor(
    primaryModel: string,
    fallbackModel: string,
    primaryError: unknown,
    fallbackError: unknown,
  ) {
    super(
      `Gemini primary (${primaryModel}) と fallback (${fallbackModel}) の両方で投稿案生成に失敗しました。`,
      { cause: fallbackError },
    );
    this.name = "PublisherModelsExhaustedError";
    this.primaryError = primaryError;
    this.fallbackError = fallbackError;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRetryableGeminiError(error: unknown): boolean {
  const message = errorMessage(error);
  return RETRYABLE_STATUSES.some((code) => message.includes(code));
}

function isTimeoutLikeError(error: unknown): boolean {
  if (error instanceof PublisherGenerationTimeoutError) return true;
  const message = errorMessage(error).toLowerCase();
  return ["timeout", "timed out", "etimedout", "aborterror"].some((term) =>
    message.includes(term),
  );
}

function isFallbackEligibleError(error: unknown): boolean {
  return isRetryableGeminiError(error) || isTimeoutLikeError(error);
}

function looksLikePolicyRefusal(error: unknown): boolean {
  if (error instanceof PublisherPolicyRefusalError) return true;
  const message = errorMessage(error).toLowerCase();
  return [
    "safety",
    "blocked",
    "block reason",
    "prohibited content",
    "recitation",
    "responsible ai",
  ].some((term) => message.includes(term));
}

function findPolicyRefusal(response: GeminiResponseLike): string | null {
  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason) {
    const reason = String(blockReason).toUpperCase();
    if (reason !== "BLOCK_REASON_UNSPECIFIED") {
      return `promptFeedback.blockReason=${reason}`;
    }
  }

  for (const candidate of response.candidates ?? []) {
    const finishReason = String(candidate.finishReason ?? "").toUpperCase();
    if (POLICY_FINISH_REASONS.has(finishReason)) {
      return `candidate.finishReason=${finishReason}`;
    }
  }

  return null;
}

function parseJsonResponse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    throw new PublisherInvalidJsonError(
      `Geminiの投稿案をJSONとして解釈できませんでした: ${detail}`,
    );
  }
}

async function generateWithModel(
  request: GeneratePostsRequest,
  modelName: string,
  options: {
    deadlineAt: number;
    maxAttempts: number;
    signal?: AbortSignal;
  },
): Promise<unknown> {
  const model = getGemini().getGenerativeModel({
    model: modelName,
    systemInstruction: HUE_PUBLISHER_SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.25,
      responseMimeType: "application/json",
      responseSchema: PUBLISHER_POSTS_RESPONSE_SCHEMA,
    },
  });
  const prompt = buildPublisherGenerationPrompt(request);

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new PublisherGenerationTimeoutError();
    }
    const remainingMs = options.deadlineAt - Date.now();
    if (remainingMs < MIN_REQUEST_BUDGET_MS) {
      throw new PublisherGenerationTimeoutError();
    }

    try {
      const result = await model.generateContent(prompt, {
        timeout: remainingMs,
        signal: options.signal,
      });
      const response: GeminiResponseLike = result.response;
      const refusal = findPolicyRefusal(response);
      if (refusal) {
        throw new PublisherPolicyRefusalError(
          `Geminiが安全・ポリシー上の理由で生成を拒否しました: ${refusal}`,
        );
      }
      return parseJsonResponse(response.text());
    } catch (error) {
      if (looksLikePolicyRefusal(error)) {
        throw error instanceof PublisherPolicyRefusalError
          ? error
          : new PublisherPolicyRefusalError(
              `Geminiが安全・ポリシー上の理由で生成を拒否しました: ${errorMessage(
                error,
              )}`,
            );
      }
      if (options.signal?.aborted) {
        throw new PublisherGenerationTimeoutError();
      }
      const retryable =
        isRetryableGeminiError(error) || isTimeoutLikeError(error);
      if (
        error instanceof PublisherInvalidJsonError ||
        !retryable ||
        attempt === options.maxAttempts
      ) {
        throw isTimeoutLikeError(error)
          ? new PublisherGenerationTimeoutError()
          : error;
      }

      const waitMs = 600 * 2 ** (attempt - 1);
      if (Date.now() + waitMs + MIN_REQUEST_BUDGET_MS >= options.deadlineAt) {
        throw new PublisherGenerationTimeoutError();
      }
      await sleep(waitMs);
    }
  }

  throw new Error("Gemini呼び出しのリトライが上限に達しました。");
}

/** Gemini固有処理をPostGenerationProvider境界内に閉じ込める。 */
export class GeminiPostGenerationProvider implements PostGenerationProvider {
  readonly name = "gemini";

  async generate(
    request: GeneratePostsRequest,
    options: PostGenerationExecutionOptions = {},
  ): Promise<PostGenerationProviderOutput> {
    const primaryModel = MODELS.text();
    const fallbackModel =
      process.env.GEMINI_TEXT_FALLBACK_MODEL?.trim() ||
      DEFAULT_FALLBACK_MODEL;
    const totalTimeoutMs = Math.max(
      MIN_REQUEST_BUDGET_MS,
      options.timeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS,
    );
    const maxAttempts = Math.min(
      MAX_ATTEMPTS_PER_MODEL,
      Math.max(
        1,
        options.maxAttemptsPerModel ?? DEFAULT_MAX_ATTEMPTS_PER_MODEL,
      ),
    );
    const deadlineAt = Date.now() + totalTimeoutMs;
    const hasDistinctFallback = fallbackModel !== primaryModel;
    const fallbackReserveMs = hasDistinctFallback
      ? Math.min(MAX_FALLBACK_RESERVE_MS, Math.floor(totalTimeoutMs * 0.4))
      : 0;
    const primaryDeadlineAt = deadlineAt - fallbackReserveMs;

    try {
      const data = await generateWithModel(request, primaryModel, {
        deadlineAt: primaryDeadlineAt,
        maxAttempts,
        signal: options.signal,
      });
      return { provider: this.name, model: primaryModel, data };
    } catch (primaryError) {
      if (
        primaryError instanceof PublisherPolicyRefusalError ||
        primaryError instanceof PublisherInvalidJsonError ||
        !isFallbackEligibleError(primaryError) ||
        !hasDistinctFallback ||
        options.signal?.aborted ||
        deadlineAt - Date.now() < MIN_REQUEST_BUDGET_MS
      ) {
        throw primaryError;
      }

      try {
        const data = await generateWithModel(request, fallbackModel, {
          deadlineAt,
          maxAttempts,
          signal: options.signal,
        });
        return { provider: this.name, model: fallbackModel, data };
      } catch (fallbackError) {
        if (fallbackError instanceof PublisherPolicyRefusalError) {
          throw fallbackError;
        }
        throw new PublisherModelsExhaustedError(
          primaryModel,
          fallbackModel,
          primaryError,
          fallbackError,
        );
      }
    }
  }
}
