import { useEffect, useRef, useState } from "react";

export function useActionNotice(durationMs = 2800) {
  const [notice, setNotice] = useState<{ title: string; detail?: string } | null>(
    null,
  );
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const showNotice = (title: string, detail?: string) => {
    setNotice({ title, detail });
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setNotice(null);
      timerRef.current = null;
    }, durationMs);
  };

  return { notice, showNotice };
}
