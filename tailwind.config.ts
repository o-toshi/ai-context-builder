import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f7f8",
          100: "#eeeef1",
          200: "#d9d9df",
          300: "#b6b6c0",
          400: "#8c8c99",
          500: "#6a6a78",
          600: "#4d4d59",
          700: "#363641",
          800: "#22222b",
          900: "#13131a",
          950: "#08080d",
        },
        accent: {
          DEFAULT: "#0f4c81",
          soft: "#e6eef7",
          fg: "#ffffff",
        },
        signal: {
          must: "#b91c1c",
          should: "#a16207",
          may: "#0f766e",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Hiragino Kaku Gothic ProN",
          "Noto Sans JP",
          "Yu Gothic",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      letterSpacing: {
        tightish: "-0.01em",
      },
      boxShadow: {
        lab: "0 1px 2px rgba(8, 8, 13, 0.04), 0 8px 24px -12px rgba(8, 8, 13, 0.08)",
      },
      borderRadius: {
        xl: "0.875rem",
      },
    },
  },
  plugins: [],
};

export default config;
