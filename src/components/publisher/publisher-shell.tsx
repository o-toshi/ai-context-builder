import type { ReactNode } from "react";
import { PUBLISHER_MODES } from "@/data/publisher-options";
import { cn } from "@/lib/utils";

interface PublisherShellProps {
  children: ReactNode;
}

export function PublisherShell({ children }: PublisherShellProps) {
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-lg font-semibold tracking-tightish text-ink-900">
              HUE Publisher
            </p>
            <p className="mt-1 text-sm text-ink-500">
              あなたの言葉を、届けたい場所へ。
            </p>
          </div>

          <nav aria-label="投稿モード" className="flex gap-2">
            {PUBLISHER_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                disabled={mode.disabled}
                aria-current={mode.value === "life" ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  mode.value === "life"
                    ? "border-ink-900 bg-ink-900 text-white"
                    : "cursor-not-allowed border-ink-200 bg-ink-50 text-ink-400",
                )}
              >
                {mode.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  );
}
