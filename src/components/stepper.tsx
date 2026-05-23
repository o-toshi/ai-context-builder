"use client";

import Link from "next/link";
import { useBuilderStore } from "@/store/builder-store";
import { BUILDER_STEPS } from "@/data/steps";
import type { StepId } from "@/types/builder";
import { cn } from "@/lib/utils";

interface StepperProps {
  current: StepId;
  /** horizontal: ラベル付き横スクロール / compact: 1〜6 の丸ボタンのみ / vertical: サイドバー */
  variant?: "horizontal" | "vertical" | "compact";
}

/**
 * 診断ウィザードのステッパー UI。
 *
 * - 完了済みステップ: クリックで遷移可能
 * - 現在ステップ: ハイライト
 * - 未着手ステップ: 非活性（だが UI 上見える）
 */
export function Stepper({ current, variant = "horizontal" }: StepperProps) {
  const completed = useBuilderStore((s) => s.progress.completed);

  if (variant === "compact") {
    return (
      <nav aria-label="進捗" className="w-full min-w-0">
        <ol className="flex flex-wrap items-center gap-2">
          {BUILDER_STEPS.map((step) => {
            const isDone = completed[step.id];
            const isCurrent = step.id === current;
            return (
              <li key={step.id}>
                <Link
                  href={step.path}
                  title={`${step.label} — ${step.description}`}
                  className={cn(
                    "flex h-9 min-w-9 items-center justify-center rounded-full border px-2 text-sm font-medium transition-colors",
                    isCurrent
                      ? "border-ink-900 bg-ink-900 text-white shadow-sm"
                      : isDone
                        ? "border-accent bg-accent text-white hover:opacity-90"
                        : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isDone && !isCurrent ? "✓" : step.index}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  if (variant === "vertical") {
    return (
      <ol className="flex flex-col gap-2">
        {BUILDER_STEPS.map((step) => {
          const isDone = completed[step.id];
          const isCurrent = step.id === current;
          return (
            <li key={step.id}>
              <Link
                href={step.path}
                className={cn(
                  "group flex items-start gap-3 rounded-lg px-3 py-2 transition-colors",
                  isCurrent
                    ? "bg-ink-50 text-ink-900"
                    : isDone
                      ? "text-ink-700 hover:bg-ink-50"
                      : "text-ink-400 hover:bg-ink-50",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium",
                    isCurrent
                      ? "border-ink-900 bg-ink-900 text-white"
                      : isDone
                        ? "border-accent bg-accent text-white"
                        : "border-ink-200 bg-white text-ink-400",
                  )}
                  aria-hidden
                >
                  {isDone && !isCurrent ? "✓" : step.index}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{step.label}</span>
                  <span className="text-xs text-ink-400">{step.description}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <nav aria-label="進捗" className="w-full min-w-0">
      <ol className="flex w-max max-w-full items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
        {BUILDER_STEPS.map((step, idx) => {
          const isDone = completed[step.id];
          const isCurrent = step.id === current;
          return (
            <li key={step.id} className="flex shrink-0 items-center gap-1.5">
              <Link
                href={step.path}
                title={`${step.label} — ${step.description}`}
                className={cn(
                  "group flex max-w-[9.25rem] shrink-0 items-center gap-2 rounded-md border px-2 py-1.5 transition-colors sm:max-w-[10rem] lg:max-w-[11rem]",
                  isCurrent
                    ? "border-ink-900 bg-white shadow-lab"
                    : isDone
                      ? "border-ink-100 bg-white hover:border-ink-200"
                      : "border-ink-100 bg-ink-50 text-ink-400",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium",
                    isCurrent
                      ? "border-ink-900 bg-ink-900 text-white"
                      : isDone
                        ? "border-accent bg-accent text-white"
                        : "border-ink-200 bg-white text-ink-400",
                  )}
                  aria-hidden
                >
                  {isDone && !isCurrent ? "✓" : step.index}
                </span>
                <div className="hidden min-w-0 flex-1 flex-col leading-tight sm:flex 2xl:hidden">
                  <span className="truncate text-[12px] font-medium tracking-tightish text-ink-900">
                    {step.label}
                  </span>
                  <span className="hidden truncate text-[10px] text-ink-400 lg:block">
                    {step.description}
                  </span>
                </div>
              </Link>
              {idx < BUILDER_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "hidden h-px w-2 shrink-0 lg:block",
                    isDone ? "bg-accent" : "bg-ink-200",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
