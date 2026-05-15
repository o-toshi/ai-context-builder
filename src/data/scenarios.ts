/**
 * シナリオテスト。
 *
 * 自由記述（第一声）+ 補助の選択肢のハイブリッド。
 * 自由記述から文体・初動パターンを抽出し、選択肢から優先順位の傾向を確定する。
 */

export interface ScenarioChoice {
  id: string;
  label: string;
  /** この選択肢が示唆する優先順位。 */
  signals: string[];
}

export interface ScenarioQuestion {
  id: string;
  /** 状況描写。 */
  situation: string;
  /** 自由記述の問いかけ（「あなたなら何と返信しますか？」など）。 */
  freeTextPrompt: string;
  /** 補助の選択肢。 */
  choicePrompt: string;
  choices: ScenarioChoice[];
  protocolHint: string;
}

export const SCENARIOS: ScenarioQuestion[] = [
  {
    id: "s_friday_01",
    situation:
      "金曜 18:00、重要クライアントから『来週月曜朝までに修正案を 3 つほしい』とメールが届いた。あなたは別件の納期も抱えており、土日は家族との予定がある。",
    freeTextPrompt:
      "クライアントへの第一声（メール本文の冒頭〜結びまで）を、いつものトーンで書いてください。",
    choicePrompt: "あなたが最初に取る行動として最も近いものは？",
    choices: [
      {
        id: "a",
        label: "即返信し、月曜朝に間に合わせる前提で土日に着手する",
        signals: ["スピード優先", "クライアント関係性 高"],
      },
      {
        id: "b",
        label: "即返信するが、月曜午後着・本数も交渉する",
        signals: ["関係性 中", "自分の時間も死守"],
      },
      {
        id: "c",
        label: "翌朝（土曜）に丁寧に返信し、月曜午後着で合意を取る",
        signals: ["品質と境界線優先"],
      },
      {
        id: "d",
        label: "別件納期を理由に、火曜以降にリスケを依頼する",
        signals: ["品質優先", "関係性 リスク受容"],
      },
    ],
    protocolHint:
      "freeText から『相手への配慮の入り方』『言い訳の有無』『提案の具体性』を、choice から速度 vs 境界線の優先度を読む。",
  },
  {
    id: "s_review_01",
    situation:
      "外注先から納品物が上がってきた。クオリティは合格点だが、あなたが想定していた方向性とはズレている。締切まで残り 3 日。",
    freeTextPrompt:
      "外注先に返すフィードバック・メッセージを、実際に送る文体でそのまま書いてください。",
    choicePrompt: "あなたの判断として最も近いものは？",
    choices: [
      {
        id: "a",
        label: "方向性は飲み込み、自分で微修正して納品する（外注先には軽くお礼のみ）",
        signals: ["速度優先", "関係性 維持優先"],
      },
      {
        id: "b",
        label: "ズレを率直に伝え、再修正を依頼する（追加費用は飲む）",
        signals: ["品質優先", "対等な関係"],
      },
      {
        id: "c",
        label: "次回からのために具体的にフィードバックを書き、今回は自分で直す",
        signals: ["長期最適", "言語化重視"],
      },
      {
        id: "d",
        label: "まず電話 / 通話で意図のすり合わせをする",
        signals: ["対面コミュニケーション選好"],
      },
    ],
    protocolHint:
      "freeText から『反論・指摘の温度』『先行肯定の有無』を抽出。choice から短期速度 vs 長期品質の優先度を読む。",
  },
  {
    id: "s_pricing_01",
    situation:
      "新サービスの月額価格を決めようとしている。月 3 万円なら確実に売れるが、5 万円だと初期は苦戦するかもしれない。提供工数は同じ。",
    freeTextPrompt:
      "あなたが信頼するアドバイザーから『どう思う？』と聞かれたとき、何と即答しますか？（思考の流れごと書いてOK）",
    choicePrompt: "最終的にあなたが取りやすい判断は？",
    choices: [
      {
        id: "a",
        label: "3 万で素早く市場検証し、後から値上げする",
        signals: ["速度優先", "学習機会 優先"],
      },
      {
        id: "b",
        label: "5 万で出し、価値で選ばれる客層を狙う",
        signals: ["品質 / ブランド優先"],
      },
      {
        id: "c",
        label: "4 万でテスト、反応を見て最終決定",
        signals: ["バランス志向"],
      },
      {
        id: "d",
        label: "まずは無料/トライアルで反応を取る",
        signals: ["リスク回避", "学習機会 最優先"],
      },
    ],
    protocolHint:
      "Priority Gate（速度 vs 品質、ROI vs 学習機会）を確定する。freeText の語尾・断定度から確実性要求も読む。",
  },
  {
    id: "s_emo_01",
    situation:
      "重要パートナーから、感情的なトーンを含む長文の不満メールが届いた（あなた側にも一部非がある内容）。",
    freeTextPrompt:
      "返信メールの最初の 3 行をそのまま書いてください（謝罪・反論・事実確認、どれから入っても構いません）。",
    choicePrompt: "返信に取り掛かる前にまず何をする？",
    choices: [
      {
        id: "a",
        label: "事実関係を整理してから返信を書く",
        signals: ["論理優先", "感情と事実の分離"],
      },
      {
        id: "b",
        label: "まず謝罪を入れて関係修復を急ぐ",
        signals: ["関係性 最優先"],
      },
      {
        id: "c",
        label: "電話で直接話す",
        signals: ["対面優先", "解像度を上げる"],
      },
      {
        id: "d",
        label: "一晩寝かせて翌朝対応",
        signals: ["感情ノイズ回避", "品質優先"],
      },
    ],
    protocolHint:
      "感情的な状況での初動パターン。triggers セクションの『IF 感情的なトーンの文章を貼られたら → THEN ...』の根拠になる。",
  },
];
