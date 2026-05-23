import { useEffect, useMemo, useState } from "react";

function parseAnsweredSignature(signature: string): Record<string, boolean> {
  if (!signature) return {};
  return Object.fromEntries(
    signature.split("|").map((part) => {
      const colon = part.indexOf(":");
      const id = part.slice(0, colon);
      const flag = part.slice(colon + 1);
      return [id, flag === "1"] as const;
    }),
  );
}

function recordsEqual(
  a: Record<string, boolean>,
  b: Record<string, boolean>,
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

/**
 * 回答直後に一覧の並びが急に変わると「次の質問へ進んだ」と誤解されやすい。
 * 未回答優先 OFF 時は元順のまま。ON 時のみ短い遅延後に並び替える。
 *
 * `answeredSignature` は呼び出し側で useMemo し、回答データが変わったときだけ更新すること。
 */
export function useStableItemOrder<T extends { id: string }>(
  items: readonly T[],
  options: {
    showUnansweredFirst: boolean;
    answeredSignature: string;
    getSortIndex: (item: T) => number;
    delayMs?: number;
  },
): T[] {
  const { showUnansweredFirst, answeredSignature, getSortIndex, delayMs = 900 } =
    options;

  const [answeredById, setAnsweredById] = useState<Record<string, boolean>>(() =>
    parseAnsweredSignature(answeredSignature),
  );

  useEffect(() => {
    const next = parseAnsweredSignature(answeredSignature);

    const apply = () => {
      setAnsweredById((prev) => (recordsEqual(prev, next) ? prev : next));
    };

    if (!showUnansweredFirst) {
      apply();
      return;
    }

    const timer = window.setTimeout(apply, delayMs);
    return () => window.clearTimeout(timer);
  }, [answeredSignature, showUnansweredFirst, delayMs]);

  return useMemo(() => {
    if (!showUnansweredFirst) return [...items];
    return [...items].sort((a, b) => {
      const aAnswered = answeredById[a.id] ? 1 : 0;
      const bAnswered = answeredById[b.id] ? 1 : 0;
      if (aAnswered !== bAnswered) return aAnswered - bAnswered;
      return getSortIndex(a) - getSortIndex(b);
    });
  }, [items, showUnansweredFirst, answeredById, getSortIndex]);
}
