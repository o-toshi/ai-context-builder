"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useBuilderStore } from "@/store/builder-store";
import { PERSONALITY_QUESTIONS } from "@/data/personality-questions";

const SCALE_LABELS = ["全く違う", "違う", "中立", "そう思う", "強くそう思う"];

export default function PersonalityPage() {
  const router = useRouter();
  const [showUnansweredFirst, setShowUnansweredFirst] = useState(true);
  const [showOnlyUnanswered, setShowOnlyUnanswered] = useState(false);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const answers = useBuilderStore((s) => s.input.personalityAnswers);
  const setAnswer = useBuilderStore((s) => s.setPersonalityAnswer);
  const setAnswers = useBuilderStore((s) => s.setPersonalityAnswers);
  const markCompleted = useBuilderStore((s) => s.markCompleted);
  const goTo = useBuilderStore((s) => s.goTo);

  const totalQuestions = PERSONALITY_QUESTIONS.length;
  const answered = answers.length;
  const completionRatio = answered / totalQuestions;
  const allDone = answered === totalQuestions;

  const valueOf = useCallback(
    (questionId: string) => answers.find((a) => a.questionId === questionId)?.value,
    [answers],
  );

  const orderedQuestions = useMemo(() => {
    if (!showUnansweredFirst) return PERSONALITY_QUESTIONS;
    return [...PERSONALITY_QUESTIONS].sort((a, b) => {
      const aAnswered = valueOf(a.id) ? 1 : 0;
      const bAnswered = valueOf(b.id) ? 1 : 0;
      return aAnswered - bAnswered;
    });
  }, [showUnansweredFirst, valueOf]);

  const questionOrderMap = useMemo(
    () =>
      new Map(
        PERSONALITY_QUESTIONS.map((q, index) => [q.id, index + 1] as const),
      ),
    [],
  );

  const visibleQuestions = useMemo(() => {
    if (!showOnlyUnanswered) return orderedQuestions;
    return orderedQuestions.filter((q) => !valueOf(q.id));
  }, [showOnlyUnanswered, orderedQuestions, valueOf]);

  const firstUnansweredId = useMemo(() => {
    return orderedQuestions.find((q) => !valueOf(q.id))?.id;
  }, [orderedQuestions, valueOf]);

  const jumpToNextUnanswered = () => {
    if (!firstUnansweredId) return;
    const node = questionRefs.current[firstUnansweredId];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const fillUnansweredWithNeutral = () => {
    PERSONALITY_QUESTIONS.forEach((q) => {
      if (valueOf(q.id)) return;
      setAnswer({ questionId: q.id, value: 3 });
    });
  };

  const handleNext = () => {
    markCompleted("personality");
    goTo("interview");
    router.push("/builder/interview");
  };

  return (
    <WorkspaceShell
      current="personality"
      title="Step 1 — 性格・嗜好の診断"
      subtitle="応答スタイルや反応パターンを観測可能なルールに翻訳するため、15問に答えてください。"
    >
      <div className="mb-6 flex items-center justify-between text-sm text-ink-500">
        <div className="flex items-center gap-3">
          <span>
            進捗: {answered} / {totalQuestions}
          </span>
          <Link
            href="/help/glossary"
            className="text-xs text-accent underline-offset-2 hover:underline"
          >
            用語ヘルプ
          </Link>
        </div>
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full bg-ink-900 transition-all"
            style={{ width: `${completionRatio * 100}%` }}
          />
        </div>
      </div>

      <Card className="mb-6 border-dashed bg-ink-50">
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={showUnansweredFirst ? "secondary" : "ghost"}
              onClick={() => setShowUnansweredFirst((v) => !v)}
            >
              {showUnansweredFirst ? "未回答優先を解除" : "未回答を先に表示"}
            </Button>
            <Button
              size="sm"
              variant={showOnlyUnanswered ? "secondary" : "ghost"}
              onClick={() => setShowOnlyUnanswered((v) => !v)}
            >
              {showOnlyUnanswered ? "全件表示に戻す" : "未回答のみ表示"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!firstUnansweredId}
              onClick={jumpToNextUnanswered}
            >
              次の未回答へ
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={fillUnansweredWithNeutral}
              disabled={answered === totalQuestions}
            >
              空欄を中立(3)で埋める
            </Button>
            <span className="text-xs text-ink-500">
              回答済み: {answered}件 / 未回答: {totalQuestions - answered}件
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {visibleQuestions.length === 0 && showOnlyUnanswered ? (
          <Card>
            <CardContent>
              <p className="py-2 text-sm text-ink-600">
                未回答の質問はありません。全件表示に戻すと回答内容を確認できます。
              </p>
            </CardContent>
          </Card>
        ) : null}
        {visibleQuestions.map((q) => {
          const current = valueOf(q.id);
          const originalOrder = questionOrderMap.get(q.id) ?? 0;
          const isAnsweredCard = typeof current === "number";
          return (
            <Card
              key={q.id}
              ref={(node) => {
                questionRefs.current[q.id] = node;
              }}
              className="scroll-mt-24"
            >
              <CardHeader>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-3">
                    <span className="text-xs font-mono text-ink-400">
                      Q{String(originalOrder).padStart(2, "0")}
                    </span>
                    <CardTitle className="font-normal leading-relaxed">
                      {q.prompt}
                    </CardTitle>
                  </div>
                  <span
                    className={
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                      (isAnsweredCard
                        ? "border-signal-may/30 bg-signal-may/10 text-signal-may"
                        : "border-signal-should/30 bg-signal-should/10 text-signal-should")
                    }
                  >
                    {isAnsweredCard ? "回答済み" : "未回答"}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {SCALE_LABELS.map((label, i) => {
                    const value = i + 1;
                    const selected = current === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setAnswer({ questionId: q.id, value })
                        }
                        className={
                          "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-[12px] font-medium transition-colors " +
                          (selected
                            ? "border-ink-900 bg-ink-900 text-white"
                            : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50")
                        }
                      >
                        <span className="font-mono text-base">{value}</span>
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!current}
                    onClick={() =>
                      setAnswers(
                        answers.filter((a) => a.questionId !== q.id),
                      )
                    }
                  >
                    この質問をクリア
                  </Button>
                  <span className="text-xs text-ink-500">
                    現在値: {current ?? "-"}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 border-dashed">
        <CardHeader>
          <CardTitle>診断結果は？</CardTitle>
          <CardDescription>
            数値はそのまま「観測可能な振る舞い」へ翻訳されます。たとえば「絵文字
            が嬉しい」を 1 と答えると、出力プロンプトでは
            <code className="mx-1 rounded bg-ink-100 px-1 py-0.5 font-mono text-xs">
              emoji = forbidden
            </code>
            に変換されます。
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push("/onboarding")}>
          ← プロフィールに戻る
        </Button>
        <Button size="lg" disabled={!allDone} onClick={handleNext}>
          {allDone ? "音声インタビューへ →" : `あと ${totalQuestions - answered} 問`}
        </Button>
      </div>
    </WorkspaceShell>
  );
}
