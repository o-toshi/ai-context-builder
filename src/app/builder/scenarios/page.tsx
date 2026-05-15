"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBuilderStore } from "@/store/builder-store";
import { SCENARIOS } from "@/data/scenarios";

function scenarioStarterTemplate(scenarioId: string): string {
  if (scenarioId === "s_friday_01") {
    return [
      "第一声（冒頭）:",
      "相手への配慮:",
      "こちらの制約:",
      "提案する着地点:",
    ].join("\n");
  }
  if (scenarioId === "s_review_01") {
    return [
      "まず肯定する点:",
      "方向性のズレをどう伝えるか:",
      "今回の着地:",
      "次回への改善依頼:",
    ].join("\n");
  }
  if (scenarioId === "s_pricing_01") {
    return [
      "結論（価格案）:",
      "判断理由:",
      "優先した指標:",
      "次の検証アクション:",
    ].join("\n");
  }
  return [
    "最初の3行:",
    "先に置く要素（謝罪/事実/提案）:",
    "関係修復のための一文:",
  ].join("\n");
}

export default function ScenariosPage() {
  const router = useRouter();
  const [showUnansweredFirst, setShowUnansweredFirst] = useState(true);
  const [showOnlyUnanswered, setShowOnlyUnanswered] = useState(false);
  const scenarioRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const answers = useBuilderStore((s) => s.input.scenarioAnswers);
  const setAnswer = useBuilderStore((s) => s.setScenarioAnswer);
  const markCompleted = useBuilderStore((s) => s.markCompleted);
  const goTo = useBuilderStore((s) => s.goTo);

  const total = SCENARIOS.length;
  const isAnswered = useCallback((scenarioId: string): boolean => {
    const scenario = SCENARIOS.find((x) => x.id === scenarioId);
    const a = answers.find((x) => x.scenarioId === scenarioId);
    return Boolean(a?.choice && a?.freeText && a.freeText.trim().length > 5 && scenario);
  }, [answers]);
  const answeredCount = SCENARIOS.filter((s) => {
    const a = answers.find((x) => x.scenarioId === s.id);
    return Boolean(a?.choice && a?.freeText && a.freeText.trim().length > 5);
  }).length;
  const allDone = answeredCount === total;

  const findAnswer = (id: string) => answers.find((a) => a.scenarioId === id);

  const orderedScenarios = useMemo(() => {
    if (!showUnansweredFirst) return SCENARIOS;
    return [...SCENARIOS].sort((a, b) => {
      const aAnswered = isAnswered(a.id) ? 1 : 0;
      const bAnswered = isAnswered(b.id) ? 1 : 0;
      return aAnswered - bAnswered;
    });
  }, [showUnansweredFirst, isAnswered]);

  const scenarioOrderMap = useMemo(
    () =>
      new Map(SCENARIOS.map((s, index) => [s.id, index + 1] as const)),
    [],
  );

  const visibleScenarios = useMemo(() => {
    if (!showOnlyUnanswered) return orderedScenarios;
    return orderedScenarios.filter((s) => !isAnswered(s.id));
  }, [showOnlyUnanswered, orderedScenarios, isAnswered]);

  const firstUnansweredId = useMemo(() => {
    return orderedScenarios.find((s) => !isAnswered(s.id))?.id;
  }, [orderedScenarios, isAnswered]);

  const jumpToNextUnanswered = () => {
    if (!firstUnansweredId) return;
    const node = scenarioRefs.current[firstUnansweredId];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      const textarea = node.querySelector("textarea") as HTMLTextAreaElement | null;
      textarea?.focus();
    }, 80);
  };

  const fillAllEmptyScenarioTemplates = () => {
    SCENARIOS.forEach((s) => {
      const current = findAnswer(s.id);
      if (current?.freeText?.trim()) return;
      setAnswer({
        scenarioId: s.id,
        choice: current?.choice,
        freeText: scenarioStarterTemplate(s.id),
      });
    });
  };

  const handleNext = () => {
    markCompleted("scenarios");
    goTo("generate");
    router.push("/builder/generate");
  };

  return (
    <WorkspaceShell
      current="scenarios"
      title="Step 3 — シナリオ判断テスト"
      subtitle="各状況での『あなたの第一声』と『最終判断』から、Priority Gate（迷ったらどちらを選ぶか）を抽出します。"
    >
      <div className="mb-6 flex items-center justify-between text-sm text-ink-500">
        <div className="flex items-center gap-3">
          <span>
            進捗: {answeredCount} / {total}
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
            style={{ width: `${(answeredCount / total) * 100}%` }}
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
              onClick={fillAllEmptyScenarioTemplates}
              disabled={answeredCount === total}
            >
              空欄にテンプレ一括挿入
            </Button>
            <span className="text-xs text-ink-500">
              回答済み: {answeredCount}件 / 未回答: {total - answeredCount}件
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5">
        {visibleScenarios.length === 0 && showOnlyUnanswered ? (
          <Card>
            <CardContent>
              <p className="py-2 text-sm text-ink-600">
                未回答のシナリオはありません。全件表示に戻すと回答内容を確認できます。
              </p>
            </CardContent>
          </Card>
        ) : null}
        {visibleScenarios.map((s) => {
          const current = findAnswer(s.id);
          const originalOrder = scenarioOrderMap.get(s.id) ?? 0;
          const isAnsweredCard = Boolean(
            current?.choice && current?.freeText?.trim() && current.freeText.trim().length > 5,
          );
          return (
            <Card
              key={s.id}
              ref={(node) => {
                scenarioRefs.current[s.id] = node;
              }}
              className="scroll-mt-24"
            >
              <CardHeader>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-3">
                    <span className="text-xs font-mono text-ink-400">
                      S{String(originalOrder).padStart(2, "0")}
                    </span>
                    <div>
                      <CardTitle className="leading-relaxed">{s.situation}</CardTitle>
                    </div>
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
                <div className="grid gap-5">
                  <div>
                    <div className="mb-2 text-sm font-medium text-ink-900">
                      {s.choicePrompt}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {s.choices.map((c) => {
                        const selected = current?.choice === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() =>
                              setAnswer({
                                scenarioId: s.id,
                                choice: c.id,
                                freeText: current?.freeText ?? "",
                              })
                            }
                            className={
                              "flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left text-sm transition-colors " +
                              (selected
                                ? "border-ink-900 bg-ink-900 text-white"
                                : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50")
                            }
                          >
                            <span className="font-medium">{c.label}</span>
                            <span
                              className={
                                "text-[11px] " +
                                (selected ? "text-ink-200" : "text-ink-400")
                              }
                            >
                              {c.signals.join(" · ")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-medium text-ink-900">
                      {s.freeTextPrompt}
                    </div>
                    <CardDescription className="mb-2">
                      実際に送る・話すトーンのまま書いてください。
                    </CardDescription>
                    <textarea
                      className="w-full rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm leading-relaxed text-ink-900 outline-none transition focus:border-ink-900 focus:ring-2 focus:ring-ink-900/10"
                      rows={5}
                      value={current?.freeText ?? ""}
                      onChange={(e) =>
                        setAnswer({
                          scenarioId: s.id,
                          choice: current?.choice,
                          freeText: e.target.value,
                        })
                      }
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setAnswer({
                            scenarioId: s.id,
                            choice: current?.choice,
                            freeText:
                              current?.freeText?.trim()
                                ? current.freeText
                                : scenarioStarterTemplate(s.id),
                          })
                        }
                      >
                        書き出しテンプレを挿入
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!(current?.choice || current?.freeText?.trim())}
                        onClick={() =>
                          setAnswer({
                            scenarioId: s.id,
                            choice: undefined,
                            freeText: "",
                          })
                        }
                      >
                        このシナリオをクリア
                      </Button>
                      <span className="text-xs font-mono text-ink-400">
                        {(current?.freeText ?? "").trim().length} chars
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push("/builder/interview")}
        >
          ← 音声インタビューに戻る
        </Button>
        <Button size="lg" disabled={!allDone} onClick={handleNext}>
          {allDone ? "プロトコル抽出へ →" : `あと ${total - answeredCount} 問`}
        </Button>
      </div>
    </WorkspaceShell>
  );
}
