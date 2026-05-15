import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { BUILDER_STEPS } from "@/data/steps";

/** フッター等の表記ゆれ防止（SSR/CSR で同じ年を出す） */
const SITE_COPYRIGHT_YEAR = 2026;

/**
 * ランディングページ。
 *
 * トーン: プロフェッショナル・ミニマル。
 * 自己分析ラボの精密機器のような清潔感を、グリッド背景・モノラル配色・
 * 微細な enumeration（番号付き要素）で表現する。
 */
export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-50">
      <div className="grid-bg absolute inset-0 opacity-60" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-px bg-ink-900/10" aria-hidden />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-white/70"
          aria-label="トップページへ戻る"
        >
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-900 bg-ink-900 text-[12px] font-semibold tracking-tightish text-white transition-colors group-hover:bg-ink-800"
          >
            AC
          </span>
          <span className="text-sm font-semibold tracking-tightish text-ink-900 transition-colors group-hover:text-ink-700">
            AI Context Builder
          </span>
          <span className="ml-2 hidden rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-tightish text-ink-500 sm:inline-block">
            Lab v0.1
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/help/glossary"
            className={buttonClassName({ variant: "ghost", size: "sm" })}
          >
            用語ヘルプ
          </Link>
          <Link
            href="/onboarding"
            className={buttonClassName({ variant: "ghost", size: "sm" })}
          >
            はじめる
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-12 pb-20 md:pt-20 md:pb-28">
        <div className="max-w-3xl">
          <span className="badge border-ink-200 bg-white text-ink-500">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            Executable Instruction Set Generator
          </span>
          <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.1] tracking-tightish text-ink-900 md:text-5xl">
            AIに、あなたの判断基準を実装する
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-ink-600 md:text-lg">
            性格診断 ・ 音声インタビュー ・ シナリオ判断の 3 つを統合し、
            AI があなた専用の<strong className="font-semibold text-ink-900">
              実行型命令セット
            </strong>
            を抽出します。「結論から述べよ」「速度と完璧さで迷ったら速度を選べ」
            といった具体プロトコルを、ChatGPT / Claude / ClaudeCode / Gemini / Cursor / その他のAI・AIエージェント
            向けに最適化して出力。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/onboarding"
              className={buttonClassName({ variant: "primary", size: "lg" })}
            >
              診断を開始する
            </Link>
            <Link
              href="#how-it-works"
              className={buttonClassName({ variant: "secondary", size: "lg" })}
            >
              仕組みを見る
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-500">
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-ink-400" aria-hidden />
              所要時間 約 15〜20 分
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-ink-400" aria-hidden />
              ログイン不要・端末内に保存
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-ink-400" aria-hidden />
              Markdown でいつでも持ち出し
            </span>
          </div>
        </div>

        {/* 出力プレビュー（モック） */}
        <div className="mt-14 grid gap-6 md:grid-cols-5">
          <div className="md:col-span-3" />
          <div className="space-y-3 md:col-span-2">
            <div className="lab-card p-5">
              <div className="text-xs font-medium uppercase tracking-tightish text-ink-500">
                Module 01
              </div>
              <div className="mt-1 text-base font-semibold tracking-tightish">
                Priority Gate
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                「A と B で迷ったら、常に A」── あなたが日々下している判断の<wbr />
                優先順位を、AI が真似できる IF-THEN 形式に翻訳します。
              </p>
            </div>
            <div className="lab-card p-5">
              <div className="text-xs font-medium uppercase tracking-tightish text-ink-500">
                Module 02
              </div>
              <div className="mt-1 text-base font-semibold tracking-tightish">
                3 階層プロトコル
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                <span className="block">
                  <span className="badge badge-must mr-1">MUST</span>
                  必須（絶対に守る）
                </span>
                <span className="block mt-1">
                  <span className="badge badge-should mr-1">SHOULD</span>
                  原則（外すときは理由を明示）
                </span>
                <span className="block mt-1">
                  <span className="badge badge-may mr-1">MAY</span>
                  方針の目安（遵守は緩め）
                </span>
                <span className="mt-2 block">
                  3段階で命令の強度を分け、AI の遵守度を制御。
                </span>
              </p>
            </div>
            <div className="lab-card p-5">
              <div className="text-xs font-medium uppercase tracking-tightish text-ink-500">
                Module 03
              </div>
              <div className="mt-1 text-base font-semibold tracking-tightish">
                4 ターゲット出力
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                ChatGPT / Claude / ClaudeCode / Gemini / Cursor (AGENTS.md) / その他のAI・AIエージェント
                それぞれに最適化した Markdown を同時に書き出します。
              </p>
            </div>

            <div
              aria-hidden
              className="flex items-center justify-center py-1 text-ink-400"
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 4V18M12 18L6.5 12.5M12 18L17.5 12.5"
                  stroke="currentColor"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="px-1 text-center">
              <span className="mt-1 text-base font-semibold tracking-tightish text-ink-900">
                プレビュー プロンプト
              </span>
            </div>

            <div className="lab-card overflow-hidden ring-1 ring-accent/30">
              <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/50 px-4 py-2.5">
                <span className="text-xs font-medium uppercase tracking-tightish text-ink-500">
                  output preview · system-prompt.md
                </span>
                <div className="flex gap-1">
                  <span className="badge badge-must">MUST</span>
                  <span className="badge badge-should">SHOULD</span>
                  <span className="badge badge-may">MAY</span>
                </div>
              </div>
              <pre className="overflow-x-auto px-5 py-5 font-mono text-[12.5px] leading-relaxed text-ink-800">
{`## 1. PRIORITY GATES（思考の優先順位）

### Gate 1: 速度と完璧さで迷ったら
**[MUST（鉄則、必須）]** 速度（70点で出す） ＞ 完璧さ
> 根拠: ユーザーは「動かしながら学ぶ」を重視している

### Gate 2: 結論と背景のどちらを先に書くか迷ったら
**[MUST（鉄則、必須）]** 結論を最初の1行に書く（BLUF） ＞ 背景・前置き

## 8. TABOOS（禁忌：絶対に取らない振る舞い）
- **[MUST]** 「素晴らしいですね」など無個性な称賛から入るな
- **[MUST]** 「一般的には〜」で始まる無個性な回答をするな
- **[MUST]** 出典のない統計値を断定的に提示するな`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="relative z-10 border-t border-ink-100 bg-white"
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <div className="flex items-end justify-between">
            <div>
              <span className="badge border-ink-200 bg-ink-50 text-ink-500">
                Process
              </span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tightish md:text-3xl">
                6 ステップで「実行型命令セット」を抽出する
              </h2>
            </div>
            <p className="hidden max-w-sm text-sm text-ink-500 md:block">
              各ステップは独立。途中で中断しても、ブラウザを閉じても、続きから再開できます。
            </p>
          </div>

          <ol className="mt-10 grid gap-3 md:grid-cols-3">
            {BUILDER_STEPS.map((step) => (
              <li key={step.id} className="lab-card p-5">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-[11px] font-semibold text-ink-700"
                  >
                    {step.index}
                  </span>
                  <div>
                    <div className="text-sm font-semibold tracking-tightish text-ink-900">
                      {step.label}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-ink-500">
                      {step.description}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Link
              href="/onboarding"
              className={buttonClassName({ variant: "primary", size: "lg" })}
            >
              無料ではじめる
            </Link>
            <span className="text-sm text-ink-500">
              ログイン・課金・送信なし。すべての回答はあなたの端末に保存されます。
            </span>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-ink-100 bg-ink-50">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-ink-500">
          <span>© {SITE_COPYRIGHT_YEAR} AI Context Builder</span>
          <div className="flex items-center gap-3">
            <Link
              href="/help/glossary"
              className="text-ink-600 underline-offset-2 hover:text-ink-900 hover:underline"
            >
              用語ミニヘルプ
            </Link>
            <span className="font-mono tracking-tightish">v0.1.0 · M1</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
