import type { GeneratePostsRequest } from "@/types/publisher";

/** AIプロバイダー固有の応答を、検証前のunknownとして境界の外へ返す。 */
export interface PostGenerationProviderOutput {
  provider: string;
  model: string;
  data: unknown;
}

/** APIルートから総処理時間と再試行上限を制御するための実行条件。 */
export interface PostGenerationExecutionOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxAttemptsPerModel?: number;
}

/** UI・API・ビジネスロジックを特定のAI SDKから分離するための契約。 */
export interface PostGenerationProvider {
  readonly name: string;
  generate(
    request: GeneratePostsRequest,
    options?: PostGenerationExecutionOptions,
  ): Promise<PostGenerationProviderOutput>;
}
