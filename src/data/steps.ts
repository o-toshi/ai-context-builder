import type { StepDefinition } from "@/types/builder";

/**
 * 診断ウィザードのステップ定義。
 * ヘッダーのステッパー、進捗計算、サイド遷移などはすべてこれを参照する。
 */
export const BUILDER_STEPS: StepDefinition[] = [
  {
    id: "onboarding",
    label: "プロフィール",
    description: "あなたの肩書きと業務文脈",
    index: 1,
    path: "/onboarding",
  },
  {
    id: "personality",
    label: "性格・嗜好",
    description: "応答スタイルと反応パターン",
    index: 2,
    path: "/builder/personality",
  },
  {
    id: "interview",
    label: "音声インタビュー",
    description: "声のトーンとニュアンス",
    index: 3,
    path: "/builder/interview",
  },
  {
    id: "scenarios",
    label: "シナリオ",
    description: "意思決定の優先順位",
    index: 4,
    path: "/builder/scenarios",
  },
  {
    id: "generate",
    label: "生成",
    description: "実行型命令セットの抽出",
    index: 5,
    path: "/builder/generate",
  },
  {
    id: "result",
    label: "編集・出力",
    description: "テスト実行とエクスポート",
    index: 6,
    path: "/result",
  },
];

export const STEP_ORDER = BUILDER_STEPS.map((s) => s.id);

export function getStep(id: string): StepDefinition | undefined {
  return BUILDER_STEPS.find((s) => s.id === id);
}
