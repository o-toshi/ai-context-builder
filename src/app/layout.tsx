import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Context Builder — あなた専用のシステムプロンプトを精密に設計する",
  description:
    "性格診断・音声インタビュー・シナリオから、AI が即座に『あなた本人』として振る舞うための実行型命令セット (Markdown) を生成します。",
  applicationName: "AI Context Builder",
  authors: [{ name: "AI Context Builder" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className="min-h-screen bg-ink-50 text-ink-900 antialiased"
        suppressHydrationWarning
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
