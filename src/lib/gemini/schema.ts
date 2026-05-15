/**
 * Gemini の `responseSchema` 用 JSON Schema 定義。
 *
 * ExecutableContext を Gemini に構造化出力させるためのスキーマ。
 * `@google/generative-ai` の SchemaType を使ってもよいが、
 * MVP では JSON literal で記述して柔軟性を保つ。
 */

import { SchemaType, type Schema } from "@google/generative-ai";

const intensityEnum: Schema = {
  type: SchemaType.STRING,
  format: "enum",
  enum: ["MUST", "SHOULD", "MAY"],
  description:
    "ルールの強度。MUST=鉄則・必須(違反不可), SHOULD=原則(外すときは理由), MAY=方針の目安・遵守は緩め。",
};

const ruleSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    intensity: intensityEnum,
    statement: {
      type: SchemaType.STRING,
      description:
        "動詞で始まる命令文。例: '結論を最初の1行に書け', '緩衝表現を使うな'。抽象語ではなく観測可能な振る舞いを記述する。",
    },
    source: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["personality", "interview", "scenarios", "inferred"],
      description: "抽出元データ。",
    },
  },
  required: ["intensity", "statement"],
};

export const EXECUTABLE_CONTEXT_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  description:
    "AI が即座に『あなた本人』として振る舞うための実行型命令セット。自己紹介ではなく実行手順書として機能すること。",
  properties: {
    coreIdentity: {
      type: SchemaType.OBJECT,
      properties: {
        role: {
          type: SchemaType.STRING,
          description: "AI が担うべき役割（例: '戦略パートナー', '思考の壁打ち相手'）。",
        },
        stance: {
          type: SchemaType.STRING,
          description: "立場（対等/補佐/メンター 等）と忖度の度合い。",
        },
        failureMode: {
          type: SchemaType.STRING,
          description: "失敗・ミス発覚時に AI が取るべき振る舞い。",
        },
      },
      required: ["role", "stance", "failureMode"],
    },
    priorityGates: {
      type: SchemaType.ARRAY,
      description:
        "Priority Gate。『AとBで迷ったら常にA』型の判断ルール。最低3つ。最重要セクション。",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          when: {
            type: SchemaType.STRING,
            description: "発動条件。例: '速度と完璧さで迷ったら'。",
          },
          choose: {
            type: SchemaType.STRING,
            description: "選ぶべき側。例: '速度'。",
          },
          over: {
            type: SchemaType.STRING,
            description: "不採用側。例: '完璧さ'。",
          },
          rationale: {
            type: SchemaType.STRING,
            description: "ユーザーの実体験に紐づく根拠（インタビュー等から）。",
          },
          intensity: intensityEnum,
        },
        required: ["id", "when", "choose", "over", "rationale", "intensity"],
      },
    },
    responseProtocol: {
      type: SchemaType.OBJECT,
      properties: {
        structure: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["BLUF", "PREP", "SDS", "FREE"],
          description: "応答構造の既定形式。",
        },
        rules: {
          type: SchemaType.ARRAY,
          items: ruleSchema,
          description: "応答の構造に関する DO/DON'T。最低3つ。",
        },
      },
      required: ["structure", "rules"],
    },
    communicationStyle: {
      type: SchemaType.OBJECT,
      properties: {
        tone: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["formal", "casual", "flat"],
        },
        maxParagraphs: { type: SchemaType.INTEGER },
        bufferPhrases: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["allowed", "forbidden"],
        },
        empathyPhrases: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["allowed", "forbidden"],
        },
        emoji: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["allowed", "minimal", "forbidden"],
        },
        allowClarifyingQuestions: { type: SchemaType.BOOLEAN },
      },
      required: [
        "tone",
        "maxParagraphs",
        "bufferPhrases",
        "empathyPhrases",
        "emoji",
        "allowClarifyingQuestions",
      ],
    },
    thinkingProtocol: {
      type: SchemaType.OBJECT,
      properties: {
        rules: {
          type: SchemaType.ARRAY,
          items: ruleSchema,
          description: "提案数・確度表記・反論作法など。最低3つ。",
        },
      },
      required: ["rules"],
    },
    decisionFramework: {
      type: SchemaType.OBJECT,
      properties: {
        priorityOrder: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "優先順位（先頭ほど強い）。例: ['スピード','品質','コスト']。",
        },
        riskTolerance: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["low", "mid", "high"],
        },
        judgmentAxes: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
      },
      required: ["priorityOrder", "riskTolerance", "judgmentAxes"],
    },
    triggers: {
      type: SchemaType.ARRAY,
      description: "IF-THEN 形式の条件付きルール。最低3つ。",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          if: { type: SchemaType.STRING },
          then: { type: SchemaType.STRING },
          intensity: intensityEnum,
        },
        required: ["id", "if", "then", "intensity"],
      },
    },
    taboos: {
      type: SchemaType.ARRAY,
      description:
        "禁忌。このユーザーが絶対に言わない・取らない振る舞い。最低3つ。インタビュー回答から最優先で抽出すること。",
      items: ruleSchema,
    },
    examples: {
      type: SchemaType.ARRAY,
      description: "Good/Bad の対比例。最低2つ。",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          scenario: { type: SchemaType.STRING },
          good: { type: SchemaType.STRING },
          bad: { type: SchemaType.STRING },
        },
        required: ["scenario", "good", "bad"],
      },
    },
    userContextSummary: {
      type: SchemaType.OBJECT,
      properties: {
        frequentTasks: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        stakeholders: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
      },
      required: ["frequentTasks", "stakeholders"],
    },
  },
  required: [
    "coreIdentity",
    "priorityGates",
    "responseProtocol",
    "communicationStyle",
    "thinkingProtocol",
    "decisionFramework",
    "triggers",
    "taboos",
    "examples",
    "userContextSummary",
  ],
};
