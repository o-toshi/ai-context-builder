# AI Context Builder

フリーランス・経営者のための「AI コンテキスト構築アプリ」。
性格診断 + 音声インタビュー + シナリオテストを統合し、AI が即座に「あなた本人」として振る舞うための **実行型命令セット (Markdown)** を生成します。

> 「このユーザーは、否定から入られるのを嫌い、結論から言うことを好む」
> 「迷ったら常にスピードを優先せよ」
>
> ── このような **Priority Gate（思考の優先順位）** と DO/DON'T を埋め込んだ
> system prompt を、ChatGPT / Claude / Gemini / Cursor 向けに出力します。

## 技術スタック

| レイヤ | 採用 |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS（プロフェッショナル・ミニマル） |
| 状態管理 | Zustand + localStorage 永続化 |
| AI | Google Gemini API (`@google/generative-ai`) |
| 音声 | Gemini Audio Input（声のトーン考慮） |

## セットアップ

```bash
cp .env.local.example .env.local
# GEMINI_API_KEY を設定

npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開く。

## 全体フロー

```
ランディング
  ↓
オンボーディング（職種・業種・規模）
  ↓
Step 1: 性格診断（Big Five + プロトコル特化設問）
  ↓
Step 2: 音声インタビュー（Gemini Audio で声のトーンも分析）
  ↓
Step 3: シナリオテスト（自由記述 + 選択式）
  ↓
プロトコル抽出（中間 JSON）
  ↓
プレビュー / 編集（DO・DON'T・Priority Gate を直接編集可能）
  ↓
テスト実行（生成プロンプトで Gemini に応答させて検証）
  ↓
ターゲット別エクスポート（ChatGPT / Claude / Gemini / Cursor AGENTS.md）
```

## 出力 Markdown の核（実行型命令セット）

- **CORE IDENTITY** … 役割・立場・失敗時の振る舞い
- **PRIORITY GATES** … 「AとBで迷ったら常にA」を IF-THEN で記述
- **RESPONSE PROTOCOL** … 結論先行 / PREP / 緩衝表現の可否
- **THINKING PROTOCOL** … 提案数・確度表記・反論作法
- **DECISION FRAMEWORK** … 優先順位・リスク許容度・判断軸
- **TRIGGERS** … 「壁打ちと言われたら質問のみ」等の条件付きルール
- **TABOOS** … このユーザーが絶対に言わないこと（禁忌）
- **EXAMPLES** … Good / Bad の対比

すべての項目には強度ラベルが付きます。

- `MUST`（鉄則）… 違反禁止
- `SHOULD`（こだわり）… 強い推奨
- `MAY`（お好み）… 任意

## ディレクトリ

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # Gemini を叩くエッジ的ルート
│   ├── builder/        # 診断〜生成のメインフロー
│   ├── onboarding/
│   └── result/
├── components/          # UI（プロフェッショナル・ミニマル）
├── data/                # 質問・シナリオ
├── hooks/
├── lib/
│   ├── gemini/         # クライアント・プロンプト・抽出
│   └── markdown/       # ターゲット別レンダラ
├── store/              # Zustand
└── types/
```

## Vercel で公開する（Production）

1. このリポジトリを GitHub / GitLab / Bitbucket に push する。
2. [Vercel](https://vercel.com) にログインし **Add New → Project** でリポジトリをインポートする。
3. **Framework Preset**: Next.js のまま **Deploy**。
4. **Settings → Environment Variables** で次を設定する（Production / Preview の両方にコピー推奨）。

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `GEMINI_API_KEY` | はい | [Google AI Studio](https://aistudio.google.com/apikey) の API キー |
| `GEMINI_TEXT_MODEL` | いいえ | 既定: `gemini-2.5-flash` |
| `GEMINI_TEXT_FALLBACK_MODEL` | いいえ | 混雑時フォールバック用 |
| `GEMINI_AUDIO_MODEL` | いいえ | 音声・文字起こし用 |
| `GEMINI_CHAT_MODEL` | いいえ | テスト実行チャット用 |
| `GEMINI_CHAT_FALLBACK_MODEL` | いいえ | チャット用フォールバック |

`.env.local.example` と同じキーでよい。

5. 環境変数保存後、**Deployments** から **Redeploy**。

**注意**: `/api/*` は `maxDuration = 60` を指定している。Vercel のプランにより実行時間上限が異なる（無料枠は短めのことがある）。長い生成がタイムアウトする場合はプラン確認か、`src/app/api/*/route.ts` の `maxDuration` を調整する。

CLI でデプロイする場合（ログイン済みのとき）:

```bash
npx vercel        # Preview
npx vercel --prod # Production
```

## ライセンス

MIT
