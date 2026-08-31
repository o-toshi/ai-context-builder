import { randomUUID } from "node:crypto";
import { countPublisherCharacters } from "@/lib/publisher/input-utils";
import { assertPublisherInputSufficient } from "@/lib/publisher/input-sufficiency";
import type {
  PostGenerationExecutionOptions,
  PostGenerationProvider,
} from "@/lib/publisher/providers/post-generation-provider";
import {
  assertRequestedPlatforms,
  validateGeneratedPostResponse,
} from "@/lib/publisher/validation";
import { isoNow } from "@/lib/utils";
import type {
  GeneratedPost,
  GeneratePostsRequest,
} from "@/types/publisher";

export interface GeneratePostsResult {
  provider: string;
  model: string;
  generatedPosts: GeneratedPost[];
}

/**
 * Provider呼び出し、AI応答検証、アプリ管理項目の付与を行うユースケース。
 * Providerが返すID・日時・文字数は受け取らず、ここでのみ生成する。
 */
export async function generatePosts(
  request: GeneratePostsRequest,
  provider: PostGenerationProvider,
  executionOptions?: PostGenerationExecutionOptions,
): Promise<GeneratePostsResult> {
  if (!request.input.id.trim()) {
    throw new Error("PostInput.idが空です。");
  }
  assertRequestedPlatforms(request.input.platforms);
  assertPublisherInputSufficient(request.input);

  const output = await provider.generate(request, executionOptions);
  const drafts = validateGeneratedPostResponse(
    output.data,
    request.input.platforms,
    request.input.hashtags,
  );
  const generatedAt = isoNow();

  return {
    provider: output.provider,
    model: output.model,
    generatedPosts: drafts.map((draft) => ({
      ...draft,
      id: randomUUID(),
      inputId: request.input.id,
      characterCount: countPublisherCharacters(draft.text),
      createdAt: generatedAt,
      updatedAt: generatedAt,
    })),
  };
}
