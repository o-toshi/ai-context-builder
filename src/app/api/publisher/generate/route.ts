import { NextResponse } from "next/server";
import { generatePosts } from "@/lib/publisher/generate-posts";
import { PublisherInputInsufficientError } from "@/lib/publisher/input-sufficiency";
import {
  GeminiPostGenerationProvider,
  PublisherGenerationTimeoutError,
  PublisherInvalidJsonError,
  PublisherModelsExhaustedError,
  PublisherPolicyRefusalError,
} from "@/lib/publisher/providers/gemini-post-generation-provider";
import {
  parseGeneratePostsRequest,
  PublisherRequestValidationError,
} from "@/lib/publisher/request-validation";
import {
  consumePublisherRateLimit,
  getPublisherClientKey,
  publisherRateLimitHeaders,
} from "@/lib/publisher/rate-limit";
import { PublisherResponseValidationError } from "@/lib/publisher/validation";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_REQUEST_BYTES = 64 * 1024;
const GENERATION_TIMEOUT_MS = 24_000;
const MAX_ATTEMPTS_PER_MODEL = 2;

type PublisherApiErrorCode =
  | "RATE_LIMITED"
  | "REQUEST_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "INPUT_INSUFFICIENT"
  | "POLICY_REFUSAL"
  | "AI_INVALID_RESPONSE"
  | "AI_TIMEOUT"
  | "AI_RATE_LIMITED"
  | "AI_CONFIGURATION_ERROR"
  | "AI_UNAVAILABLE"
  | "INTERNAL_ERROR";

interface ClassifiedError {
  code: PublisherApiErrorCode;
  message: string;
  status: number;
  retryable: boolean;
  retryAfterMs?: number;
}

function errorResponse(error: ClassifiedError, headers?: HeadersInit) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        ...(error.retryAfterMs
          ? { retryAfterMs: error.retryAfterMs }
          : {}),
      },
      // クライアントは送信済み入力を破棄せず、再試行に利用できる。
      inputPreserved: true,
    },
    { status: error.status, headers },
  );
}

function collectErrorMessages(error: unknown): string[] {
  if (error instanceof PublisherModelsExhaustedError) {
    return [
      error.message,
      ...collectErrorMessages(error.primaryError),
      ...collectErrorMessages(error.fallbackError),
    ];
  }
  return [error instanceof Error ? error.message : String(error)];
}

function classifyError(error: unknown): ClassifiedError {
  if (error instanceof PublisherRequestValidationError) {
    return {
      code: "VALIDATION_ERROR",
      message: error.message,
      status: 400,
      retryable: false,
    };
  }
  if (error instanceof PublisherInputInsufficientError) {
    return {
      code: "INPUT_INSUFFICIENT",
      message: error.message,
      status: 422,
      retryable: false,
    };
  }
  if (error instanceof PublisherPolicyRefusalError) {
    return {
      code: "POLICY_REFUSAL",
      message:
        "この内容では投稿案を作れませんでした。入力内容や表現を見直してください。",
      status: 422,
      retryable: false,
    };
  }
  const terminalError =
    error instanceof PublisherModelsExhaustedError
      ? error.fallbackError
      : error;
  if (terminalError instanceof PublisherGenerationTimeoutError) {
    return {
      code: "AI_TIMEOUT",
      message:
        "投稿案の準備に時間がかかっています。入力は残っているため、そのまま再試行できます。",
      status: 504,
      retryable: true,
      retryAfterMs: 1_000,
    };
  }
  if (
    terminalError instanceof PublisherInvalidJsonError ||
    terminalError instanceof PublisherResponseValidationError
  ) {
    return {
      code: "AI_INVALID_RESPONSE",
      message:
        "投稿案を正しい形式で受け取れませんでした。入力は残っているため、再試行してください。",
      status: 502,
      retryable: true,
      retryAfterMs: 1_000,
    };
  }

  const combinedMessage = collectErrorMessages(error)
    .join("\n")
    .toLowerCase();
  if (
    combinedMessage.includes("gemini_api_key") ||
    combinedMessage.includes("api key") ||
    combinedMessage.includes("401") ||
    combinedMessage.includes("403")
  ) {
    return {
      code: "AI_CONFIGURATION_ERROR",
      message:
        "現在、投稿案生成サービスを利用できません。管理者へ設定確認を依頼してください。",
      status: 503,
      retryable: false,
    };
  }
  if (
    combinedMessage.includes("429") ||
    combinedMessage.includes("quota") ||
    combinedMessage.includes("rate limit")
  ) {
    return {
      code: "AI_RATE_LIMITED",
      message:
        "現在リクエストが集中しています。入力は残っているため、少し待ってから再試行してください。",
      status: 429,
      retryable: true,
      retryAfterMs: 30_000,
    };
  }
  if (
    error instanceof PublisherModelsExhaustedError ||
    combinedMessage.includes("500") ||
    combinedMessage.includes("502") ||
    combinedMessage.includes("503") ||
    combinedMessage.includes("504")
  ) {
    return {
      code: "AI_UNAVAILABLE",
      message:
        "現在、投稿案生成サービスが一時的に不安定です。入力は残っているため、時間を置いて再試行してください。",
      status: 503,
      retryable: true,
      retryAfterMs: 5_000,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message:
      "投稿案の生成中に問題が発生しました。入力は残っているため、再試行できます。",
    status: 500,
    retryable: true,
    retryAfterMs: 1_000,
  };
}

/** POST /api/publisher/generate */
export async function POST(request: Request) {
  const rateLimit = consumePublisherRateLimit(getPublisherClientKey(request));
  const responseHeaders = publisherRateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) {
    return errorResponse(
      {
        code: "RATE_LIMITED",
        message:
          "短い時間に投稿案の作成が続いています。入力は残っているため、少し待ってから再試行してください。",
        status: 429,
        retryable: true,
        retryAfterMs: rateLimit.retryAfterMs,
      },
      responseHeaders,
    );
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return errorResponse(
      {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Content-Typeはapplication/jsonで送信してください。",
        status: 415,
        retryable: false,
      },
      responseHeaders,
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return errorResponse(
      {
        code: "REQUEST_TOO_LARGE",
        message: "入力データが大きすぎます。内容を短くして再試行してください。",
        status: 413,
        retryable: false,
      },
      responseHeaders,
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse(
      {
        code: "INVALID_JSON",
        message: "リクエストのJSON形式が正しくありません。",
        status: 400,
        retryable: false,
      },
      responseHeaders,
    );
  }

  let generationRequest;
  try {
    generationRequest = parseGeneratePostsRequest(rawBody);
  } catch (error) {
    return errorResponse(classifyError(error), responseHeaders);
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort(new PublisherGenerationTimeoutError());
  }, GENERATION_TIMEOUT_MS);
  const abortOnClientDisconnect = () => {
    abortController.abort(request.signal.reason);
  };
  request.signal.addEventListener("abort", abortOnClientDisconnect, {
    once: true,
  });

  try {
    const result = await generatePosts(
      generationRequest,
      new GeminiPostGenerationProvider(),
      {
        signal: abortController.signal,
        timeoutMs: GENERATION_TIMEOUT_MS,
        maxAttemptsPerModel: MAX_ATTEMPTS_PER_MODEL,
      },
    );

    return NextResponse.json(
      { ok: true, data: result },
      { headers: responseHeaders },
    );
  } catch (error) {
    const classified = classifyError(error);
    console.error(`[publisher/generate] ${classified.code}`, error);
    return errorResponse(classified, responseHeaders);
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortOnClientDisconnect);
  }
}
