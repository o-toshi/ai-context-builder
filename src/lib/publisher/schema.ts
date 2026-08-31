import { SchemaType, type Schema } from "@google/generative-ai";

/** HUE Publisher専用のGemini構造化出力Schema。選択SNSとの一致は別途検証する。 */
export const PUBLISHER_POSTS_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    posts: {
      type: SchemaType.ARRAY,
      description:
        "選択されたSNSごとの投稿案。各SNSを1件ずつ、入力された順序で返す。",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          platform: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["x", "threads", "facebook", "linkedin", "note"],
          },
          text: {
            type: SchemaType.STRING,
            description:
              "ユーザーがそのまま確認・編集・コピーできる投稿本文。使用するハッシュタグも含める。",
          },
          hashtags: {
            type: SchemaType.ARRAY,
            description:
              "text内で実際に使用したハッシュタグ。#を除いた文字列で返す。",
            items: { type: SchemaType.STRING },
          },
        },
        required: ["platform", "text", "hashtags"],
      },
    },
  },
  required: ["posts"],
};
