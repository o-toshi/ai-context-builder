"use client";

import Link from "next/link";
import { useBuilderStore } from "@/store/builder-store";
import { BUILDER_STEPS } from "@/data/steps";
import type { StepId } from "@/types/builder";
import { cn } from "@/lib/utils";

interface StepperProps {
  current: StepId;
  /** モード: 横並びの大きいバー or サイドバー（縦） */
  variant?: "horizontal" | "vertical";
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
    <nav aria-label="進捗" className="w-full">
      <ol className="flex items-center gap-2 overflow-x-auto md:overflow-visible">
        {BUILDER_STEPS.map((step, idx) => {
          const isDone = completed[step.id];
          const isCurrent = step.id === current;
          return (
            <li key={step.id} className="flex shrink-0 items-center gap-2 md:flex-1 md:min-w-0">
              <Link
                href={step.path}
                className={cn(
                  "group flex min-w-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 transition-colors md:flex-1 md:justify-start md:gap-3 md:px-3",
                  isCurrent
                    ? "border-ink-900 bg-white shadow-lab"
                    : isDone
                      ? "border-ink-100 bg-white hover:border-ink-200"
                      : "border-ink-100 bg-ink-50 text-ink-400",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium",
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
                <div className="hidden flex-col leading-tight md:flex">
                  <span className="text-[13px] font-medium tracking-tightish text-ink-900">
                    {step.label}
                  </span>
                  <span className="text-[11px] text-ink-400">
                    {step.description}
                  </span>
                </div>
              </Link>
              {idx < BUILDER_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "hidden h-px w-4 md:block",
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
