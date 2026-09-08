/** HUE Publisher v1.0 で生成対象にするSNS。 */
export type PublisherPlatform =
  | "x"
  | "threads"
  | "facebook"
  | "linkedin"
  | "note";

/** 将来のモード切替を型として予約する。v1.0で入力可能なのは life のみ。 */
export type PublisherMode = "life" | "project";

export type PublisherEmotion =
  | "joy"
  | "moved"
  | "gratitude"
  | "insight"
  | "passion"
  | "challenge"
  | "sadness"
  | "issue"
  | "support";

export type PublisherPurpose =
  | "empathy"
  | "awareness"
  | "reflection"
  | "action"
  | "encouragement"
  | "record";

/** ライフ型の1回分の入力。URL先の取得は行わず、抽出結果だけを保持する。 */
export interface PostInput {
  id: string;
  mode: "life";
  message: string;
  emotion: PublisherEmotion;
  purpose: PublisherPurpose;
  hashtags: string[];
  platforms: PublisherPlatform[];
  sourceUrls: string[];
  createdAt: string;
}

/**
 * 将来、AI Context Builder等から注入する個人コンテキスト。
 * v1.0ではUIを設けず、生成要求では未指定のまま利用する。
 */
export interface PublisherGenerationContext {
  writingStyle?: string;
  decisionPrinciples?: string[];
  values?: string[];
  communicationStyle?: string;
}

export interface GeneratePostsRequest {
  input: PostInput;
  context?: PublisherGenerationContext;
}

/** AIプロバイダーから受け取り、アプリ側で検証する生成途中のデータ。 */
export interface GeneratedPostDraft {
  platform: PublisherPlatform;
  text: string;
  hashtags: string[];
}

export interface GeneratedPost extends GeneratedPostDraft {
  id: string;
  inputId: string;
  characterCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 1回の生成で作られたSNS別投稿案一式を、履歴1件として保存する。 */
export interface PostHistory {
  id: string;
  input: PostInput;
  generatedPosts: GeneratedPost[];
  status: "saved";
  createdAt: string;
  updatedAt: string;
}
