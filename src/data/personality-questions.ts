/**
 * 性格診断 + プロトコル抽出特化設問。
 *
 * Big Five だけでは「実行型命令」に翻訳しにくいので、
 * 「応答長さ嗜好 / 否定耐性 / 結論先行度 / 確実性要求 / 緩衝表現許容 / 絵文字 / 質問返し許容」
 * など、AI の振る舞いに直接マップできるカテゴリを混ぜている。
 */

export type PersonalityCategory =
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "neuroticism"
  | "response_length"
  | "negation_tolerance"
  | "conclusion_first"
  | "certainty_demand"
  | "buffer_phrases"
  | "emoji_preference"
  | "clarifying_questions"
  | "decision_priority";

export interface PersonalityQuestion {
  id: string;
  category: PersonalityCategory;
  /** 質問文。Likert 5 段階（1: 全く違う 〜 5: 強くそう思う）で回答。 */
  prompt: string;
  /** 反転項目か（5 が「強くそう思う」ではなく、より否定的な意味になるか）。 */
  reversed?: boolean;
  /** プロトコル抽出時のヒント。Gemini に渡される。 */
  protocolHint: string;
}

export const PERSONALITY_QUESTIONS: PersonalityQuestion[] = [
  {
    id: "p_clen_01",
    category: "response_length",
    prompt: "AI からの返答は、短くキレのあるものより、丁寧で網羅的な方が好ましい。",
    reversed: true,
    protocolHint:
      "5 に近いほど maxParagraphs は大きく、緩衝表現の許容度も上がる。1 に近いほど BLUF を強制し maxParagraphs=2 程度。",
  },
  {
    id: "p_neg_01",
    category: "negation_tolerance",
    prompt: "自分のアイデアに真っ向から反論されると、強くストレスを感じる。",
    protocolHint:
      "5 に近いほど『反論前に肯定を 1 行入れろ』『代替案を必ず添えろ』という制約を強める。1 に近いほど『遠慮せず即異論を述べよ』を MUST 化。",
  },
  {
    id: "p_neg_02",
    category: "negation_tolerance",
    prompt: "自分の案にダメ出しをくれる相手の方が、最終的には信頼できる。",
    protocolHint: "p_neg_01 の補正項目。両方を見て negation_tolerance を確定する。",
  },
  {
    id: "p_concl_01",
    category: "conclusion_first",
    prompt: "会議では、先に結論を述べてから背景を説明するのが好きだ。",
    protocolHint:
      "5 に近いほど ResponseProtocol.structure='BLUF' を MUST。1 に近いほど SDS / 背景先行も許容。",
  },
  {
    id: "p_cert_01",
    category: "certainty_demand",
    prompt: "曖昧な提案（「たぶん」「かもしれない」を多用するもの）は受け入れがたい。",
    protocolHint:
      "5 に近いほど『不確実性は確度: 高/中/低 で明示せよ』『弱い断定を禁止』を MUST。",
  },
  {
    id: "p_buf_01",
    category: "buffer_phrases",
    prompt: "「お気持ちわかります」「いかがでしょうか」など、丁寧なクッション言葉は嬉しい。",
    reversed: true,
    protocolHint: "communicationStyle.bufferPhrases / empathyPhrases の決定に使う。",
  },
  {
    id: "p_emo_01",
    category: "emoji_preference",
    prompt: "AI からのメッセージに絵文字が混ざるのは、親しみやすくて好ましい。",
    reversed: true,
    protocolHint: "communicationStyle.emoji を allowed / minimal / forbidden に対応付け。",
  },
  {
    id: "p_clar_01",
    category: "clarifying_questions",
    prompt: "AI が前提を確認するために逆質問してくるのは、丁寧で良いことだ。",
    reversed: true,
    protocolHint:
      "5 に近いほど allowClarifyingQuestions=true。1 に近いほど『仮置きで進めよ。確認は最後にまとめろ』を MUST。",
  },
  {
    id: "p_pri_speed",
    category: "decision_priority",
    prompt: "迷ったら、完璧さよりまずスピードを優先することが多い。",
    protocolHint:
      "Priority Gate『速度 vs 品質』の重要シグナル。5 に近いほど『迷ったら速度を選べ』を MUST 化。",
  },
  {
    id: "p_pri_cost",
    category: "decision_priority",
    prompt: "コストよりも、関係性や信頼を優先して投資判断をする方だ。",
    protocolHint:
      "Priority Gate『コスト vs 関係性』。decisionFramework.priorityOrder の先頭候補を決める。",
  },
  {
    id: "p_open_01",
    category: "openness",
    prompt: "新しいツールやフレームワークを試すのが好きだ。",
    protocolHint: "openness。提案の冒険度（保守的提案 vs 大胆な提案）に影響。",
  },
  {
    id: "p_cons_01",
    category: "conscientiousness",
    prompt: "計画通りに物事を進めることに強いこだわりがある。",
    protocolHint: "conscientiousness。タスク管理スタイル・締切提示の有無に影響。",
  },
  {
    id: "p_extr_01",
    category: "extraversion",
    prompt: "人と話すことでアイデアが整理されるタイプだ。",
    protocolHint: "壁打ち UX を強化するか、要約先行型にするかに影響。",
  },
  {
    id: "p_agr_01",
    category: "agreeableness",
    prompt: "意見の対立は、できれば避けたい。",
    protocolHint: "agreeableness。反論の温度・先行肯定の有無に影響。",
  },
  {
    id: "p_neu_01",
    category: "neuroticism",
    prompt: "重要な判断を控えていると、夜眠れなくなることがある。",
    protocolHint: "neuroticism。安心材料の提示量・リスク表現の温度感に影響。",
  },
];
