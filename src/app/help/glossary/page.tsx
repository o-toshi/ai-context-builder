import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "用語ミニヘルプ | AI Context Builder",
  description:
    "Priority Gate・強度（MUST/SHOULD/MAY）・結果画面で触る用語の短文リファレンス。",
};

export default function GlossaryPage() {
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="z-10 border-b border-ink-100 bg-white/90 md:sticky md:top-0 md:backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 md:px-6">
          <Link
            href="/"
            className={buttonClassName({
              variant: "ghost",
              size: "sm",
              className: "-ml-1",
            })}
          >
            ← トップ
          </Link>
          <span className="text-sm font-semibold text-ink-900">
            用語ミニヘルプ
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 md:px-6 md:py-10">
        <p className="text-sm leading-relaxed text-ink-600">
          結果画面や Markdown に出てくる用語の、「意味」と「編集するときの目安」だけをまとめています。
          <span className="font-medium text-ink-800">
            Thinking Protocol / Triggers
          </span>
          は、いまのアプリでは手編集しない前提のため、このページでも扱いません（生成結果の自動反映のみ）。
        </p>

        <Card>
          <CardHeader>
            <CardTitle>強度（MUST / SHOULD / MAY）</CardTitle>
            <CardDescription>
              ルールや Gate に付く「どれだけ厳しく守らせるか」の印です。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-ink-700">
            <p>
              <span className="font-medium text-ink-900">MUST（鉄則、必須）</span>
              … 外すとプロトコル違反とみなす<span className="font-medium text-ink-900">最優先</span>。配布前チェックの「要修正」になりやすい。
            </p>
            <p>
              <span className="font-medium text-ink-900">
                SHOULD（原則、外すときは理由）
              </span>
              … 原則として従わせる。逸脱するなら、文脈で言い訳が立つかを意識するイメージです。
            </p>
            <p>
              <span className="font-medium text-ink-900">
                MAY（方針の目安、遵守は緩め）
              </span>
              … 厳密な義務ではなく、<span className="font-medium text-ink-900">目安・付け足し</span>。Priority
              Gate に書いても「迷いを減らす参考」であって、必須ルールではない、という位置づけです。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Priority Gate</CardTitle>
            <CardDescription>
              「A と B で迷ったら、常に A」という<span className="font-medium text-ink-900">判断の分岐</span>のリストです。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed text-ink-700">
            <p>
              When（いつ迷うか）・Choose（取る側）・Over（比較対象）・Rationale（なぜそうするか）で、人間の優先順位を命令形に近い形で残します。
            </p>
            <p>
              件数が少ないと「公開前チェック」で注意されます。迷いが複数あるほど、AI
              の挙動が安定しやすいです。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Response Protocol</CardTitle>
            <CardDescription>
              回答の<span className="font-medium text-ink-900">型・手順</span>をルールの列で守らせます（例: 結論先出し・箇条書きの使い方）。
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-ink-700">
            <p>
              1 行が 1 つの観測しやすい命令だと、プロンプトとして効きやすくなります。抽象的な副詞だけの文はチェックで注意されることがあります。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Taboos</CardTitle>
            <CardDescription>
              <span className="font-medium text-ink-900">してはいけない振る舞い</span>のリストです。
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-ink-700">
            <p>
              Response と同じく強度付きのルールです。同じ文が重なると優先度が曖昧になるため、重複は警告の対象になります。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Examples（Good / Bad）</CardTitle>
            <CardDescription>
              シナリオごとに「望ましい／避けたい」振る舞いを並べ、<span className="font-medium text-ink-900">教示用の例</span>として使います。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed text-ink-700">
            <p>
              音声や会話の書き起こしをそのまま載せて構いません。似た表現が並んでも、話し方の個性として残す判断で問題ない、という位置づけです（ルールの重複チェックとは別）。
            </p>
            <p>
              件数ゼロや、シナリオ・Good・Bad の空欄は「公開前チェック」で案内されます。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>公開前チェック</CardTitle>
            <CardDescription>
              実運用に回す前の、画面内ライトな品質確認です。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed text-ink-700">
            <p>
              <span className="font-medium text-ink-900">要修正（赤）</span>
              … 配布・共有前に解消を推奨。
            </p>
            <p>
              <span className="font-medium text-ink-900">注意（黄）</span>
              … 可能なら改善。
            </p>
            <p>
              <span className="font-medium text-ink-900">良好系（薄色）</span>
              … クリアの表示。配布のブロッカーではありません。行によってはクリック不要です。
            </p>
            <p>
              行をクリックすると、対応する編集ブロックへ移動できるものがあります。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>編集モード・保存・エクスポート</CardTitle>
            <CardDescription>
              結果画面の操作だけ、短く。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed text-ink-700">
            <p>
              <span className="font-medium text-ink-900">編集モード</span>
              … ここでの変更は下書きです。
              <span className="font-medium text-ink-900">保存して反映</span>
              を押すまで確定しません。
            </p>
            <p>
              <span className="font-medium text-ink-900">バックアップ保存</span>
              … 画面上部。確定後のデータを JSON で退避する用途です。
            </p>
            <p>
              <span className="font-medium text-ink-900">エクスポート</span>
              … ChatGPT / Claude / Gemini / Cursor など、ターゲット別の Markdown。コピーまたはダウンロードします。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>テスト実行（Gemini / stub）</CardTitle>
            <CardDescription>
              結果画面の右側チャットで、現在のプロンプトをその場で試す機能です。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed text-ink-700">
            <p>
              <span className="font-medium text-ink-900">gemini</span>
              … 通常の実行。API が利用可能なときの応答です。
            </p>
            <p>
              <span className="font-medium text-ink-900">stub</span>
              … API キー未設定などで、ダミー応答を返します。画面上に注意メッセージが表示されます。
            </p>
            <p>
              <span className="font-medium text-ink-900">stub_due_to_quota</span>
              … 利用枠超過（429）時のフォールバック。入力や履歴は失われず、quota 回復後に再実行できます。
            </p>
            <p>
              通信失敗や認証失敗時は、画面内に短いエラーメッセージで原因候補（ネットワーク / APIキー / 一時不調）を表示します。
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            href="/result"
            className={buttonClassName({ variant: "secondary", size: "sm" })}
          >
            結果画面へ
          </Link>
          <Link
            href="/onboarding"
            className={buttonClassName({ variant: "ghost", size: "sm" })}
          >
            ウィザードへ
          </Link>
        </div>
      </main>
    </div>
  );
}
