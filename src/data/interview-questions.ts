/**
 * 音声インタビュー設問。
 *
 * Gemini Audio に音声 + 質問文を渡し、文字起こしと
 * 「声のトーン・話速・断定度」などを抽出する。
 *
 * 設計の要点:
 *   - DON'T を引き出す質問（うざいと感じた言い回し / 解雇したくなる振る舞い）
 *   - 優先順位を引き出す質問（即決パターン vs 持ち帰りパターン）
 *   - 口癖・常套句が出やすい開かれた質問
 */

export interface InterviewQuestion {
  id: string;
  prompt: string;
  /** 何秒以内で答えるべきかの目安。 */
  recommendedSec: number;
  /** プロトコル抽出時のヒント。Gemini に渡される。 */
  protocolHint: string;
}

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: "i_uzai_01",
    prompt:
      "直近で AI やアシスタントの返答に「うざい」「読みたくない」と感じた瞬間は？具体的にどんな言い回しでしたか？",
    recommendedSec: 60,
    protocolHint:
      "ユーザー固有の地雷ワードを抽出する。HARD CONSTRAINTS / TABOOS の最重要シグナル。",
  },
  {
    id: "i_rules_01",
    prompt:
      "あなたが部下や外注先に指示を出すとき、絶対に守らせるルールが 3 つあるとしたら何ですか？",
    recommendedSec: 90,
    protocolHint:
      "コミュニケーション・プロトコルへ直接翻訳できる『鉄則』のソース。MUST レベルのルール候補。",
  },
  {
    id: "i_decide_01",
    prompt:
      "提案を受けたとき、即決できるパターンと持ち帰るパターンの違いを教えてください。何で線引きしていますか？",
    recommendedSec: 90,
    protocolHint: "decisionFramework.priorityOrder と Priority Gate の根拠になる。",
  },
  {
    id: "i_fire_01",
    prompt:
      "あなたが「即解雇したくなる」アシスタントの振る舞いは？逆に、最高のアシスタントの一言で印象に残っているものは？",
    recommendedSec: 90,
    protocolHint:
      "TABOOS と Good Example を同時に取れる。Good 側は examples セクションへ、Bad 側は taboos / hardConstraints へ。",
  },
  {
    id: "i_speed_01",
    prompt:
      "完璧な品質を出すまで時間をかけるのと、70 点でも先に動かすの、最近のあなたはどちら寄りですか？最後にその選択をしたエピソードを教えてください。",
    recommendedSec: 90,
    protocolHint: "Priority Gate『速度 vs 品質』を最も明確に取れる質問。",
  },
];
