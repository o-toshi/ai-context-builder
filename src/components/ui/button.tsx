import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950 disabled:bg-ink-300",
  secondary:
    "border border-ink-200 bg-white text-ink-900 hover:bg-ink-50 active:bg-ink-100 disabled:opacity-60",
  ghost:
    "text-ink-700 hover:bg-ink-100 active:bg-ink-200 disabled:opacity-50",
  danger:
    "bg-signal-must text-white hover:opacity-90 active:opacity-95 disabled:opacity-60",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm rounded-md",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-12 px-6 text-base rounded-lg",
};

const BUTTON_BASE_CLASS =
  "inline-flex select-none items-center justify-center gap-2 font-medium tracking-tightish transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed";

/** Next.js の `<Link>` をボタン見た目にするとき（`<a>` 内に `<button>` を入れない） */
export function buttonClassName(
  options: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
  } = {},
): string {
  const variant = options.variant ?? "primary";
  const size = options.size ?? "md";
  return cn(BUTTON_BASE_CLASS, VARIANT[variant], SIZE[size], options.className);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={buttonClassName({ variant, size, className })}
      {...props}
    />
  ),
);
Button.displayName = "Button";
