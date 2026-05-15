"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { PERSONALITY_QUESTIONS } from "@/data/personality-questions";
import { INTERVIEW_QUESTIONS } from "@/data/interview-questions";
import { SCENARIOS } from "@/data/scenarios";
import type { GenerateContextRequest } from "@/types/gemini";
import {
  formatClientFetchError,
  formatHttpError,
} from "@/lib/user-facing-errors";

type Phase = "idle" | "running" | "done" | "error";

type MissingItem = {
  id: string;
  message: string;
  href: string;
  actionLabel: string;
};

export default function GeneratePage() {
  const router = useRouter();
  const input = useBuilderStore((s) => s.input);
  const setContext = useBuilderStore((s) => s.setContext);
  const setExports = useBuilderStore((s) => s.setExports);
  const markCompleted = useBuilderStore((s) => s.markCompleted);
  const goTo = useBuilderStore((s) => s.goTo);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [mode, setMode] = useState<
    "stub" | "gemini" | "stub_due_to_quota" | undefined
  >();
  /** quota フォールバックなど、成功だが注意が必要なとき */
  const [completionWarning, setCompletionWarning] = useState<string>("");

  const missingRequirements = useMemo((): MissingItem[] => {
    const list: MissingItem[] = [];
    if (!input.profile.role?.trim()) {
      list.push({
        id: "profile-role",
        message: "基本プロフィールで「役割・肩書き」を入力してください。",
        href: "/onboarding",
        actionLabel: "基本プロフィールへ",
      });
    }
    if (!input.profile.industry?.trim()) {
      list.push({
        id: "profile-industry",
        message: "基本プロフィールで「業界・領域」を入力してください。",
        href: "/onboarding",
        actionLabel: "基本プロフィールへ",
      });
    }
    if (!input.profile.teamSize?.trim()) {
      list.push({
        id: "profile-team",
        message: "基本プロフィールで「チーム規模」を入力してください。",
        href: "/onboarding",
        actionLabel: "基本プロフィールへ",
      });
    }
    if (input.personalityAnswers.length === 0) {
      list.push({
        id: "personality",
        message: "ステップ1の性格・嗜好の質問に、1問以上答えてください。",
        href: "/builder/personality",
        actionLabel: "ステップ1へ",
      });
    }
    if (input.interviewClips.length === 0) {
      list.push({
        id: "interview",
        message:
          "ステップ2のインタビューに、1問以上答えてください（今は文章入力でも大丈夫です）。",
        href: "/builder/interview",
        actionLabel: "ステップ2へ",
      });
    }
    if (input.scenarioAnswers.length === 0) {
      list.push({
        id: "scenarios",
        message: "ステップ3のシナリオに、1問以上答えてください。",
        href: "/builder/scenarios",
        actionLabel: "ステップ3へ",
      });
    }
    return list;
  }, [input]);

  const canGenerate = missingRequirements.length === 0;

  const buildRequest = (): GenerateContextRequest => ({
    profile: {
      displayName: input.profile.displayName,
      role: input.profile.role ?? "",
      industry: input.profile.industry ?? "",
      teamSize: input.profile.teamSize ?? "",
    },
    personality: PERSONALITY_QUESTIONS.map((q) => ({
      questionId: q.id,
      prompt: q.prompt,
      value:
        input.personalityAnswers.find((a) => a.questionId === q.id)?.value ?? 3,
    })),
    interview: INTERVIEW_QUESTIONS.map((q) => {
      const clip = input.interviewClips.find((c) => c.questionId === q.id);
      return {
        questionId: q.id,
        prompt: q.prompt,
        transcript: clip?.transcript,
        prosodyNote: clip?.prosody?.note,
      };
    }),
    scenarios: SCENARIOS.map((s) => {
      const a = input.scenarioAnswers.find((x) => x.scenarioId === s.id);
      return {
        scenarioId: s.id,
        prompt: s.situation,
        freeText: a?.freeText,
        choice: a?.choice,
      };
    }),
  });

  const run = async () => {
    if (!canGenerate) {
      return;
    }

    setPhase("running");
    setError("");
    setCompletionWarning("");
    try {
      const res = await fetch("/api/generate-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequest()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const raw =
          typeof data?.error === "string" ? data.error : `HTTP ${res.status}`;
        throw new Error(formatHttpError(res.status, raw));
      }
      setContext(data.context);
      const exports: Record<string, string> = {};
      for (const [target, info] of Object.entries(data.exports) as Array<
        [string, { markdown: string }]
      >) {
        exports[target] = info.markdown;
      }
      setExports(exports);
      setMode(data.mode);
      setCompletionWarning(
        typeof data.warning === "string" ? data.warning : "",
      );
      markCompleted("generate");
      setPhase("done");
    } catch (err) {
      setError(formatClientFetchError(err));
      setPhase("error");
    }
  };

  useEffect(() => {
    if (!canGenerate) {
      setPhase("idle");
      setError("");
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGenerate]);

  const handleNext = () => {
    goTo("result");
    router.push("/result");
  };

  return (
    <WorkspaceShell
      current="generate"
      title={
        canGenerate ? "プロトコル抽出中..." : "このあと生成できます"
      }
      subtitle={
        canGenerate
          ? "あなたの回答を AI で分析し、実行型命令セット（Markdown）に変換しています。"
          : "入力が足りないため、ここではまだ生成を始められません。下の案内から不足している画面へ進んでください。"
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>生成ステータス</CardTitle>
          <CardDescription>
            {canGenerate
              ? "通常 10〜20 秒で完了します。中断しても入力データは保持されます。"
              : "不足している入力を済ませてから、このページに戻ると自動で生成が始まります。"}
            {" "}
            <Link
              href="/help/glossary"
              className="text-accent underline-offset-2 hover:underline"
            >
              用語ヘルプ
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!canGenerate && (
            <div className="mb-4 rounded-md border border-signal-must/30 bg-signal-must/5 px-4 py-3 text-sm text-signal-must">
              <strong className="mb-2 block">先に入力を完了してください</strong>
              <p className="mb-3 text-xs leading-relaxed opacity-90">
                用語は覚えなくて大丈夫です。ボタンからその画面へ進み、足りないところだけ埋めてから、もう一度このページを開いてください。
              </p>
              <ul className="space-y-2">
                {missingRequirements.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col gap-1 rounded-md border border-signal-must/20 bg-white/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-ink-800">{item.message}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="shrink-0"
                      onClick={() => router.push(item.href)}
                    >
                      {item.actionLabel}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {phase === "running" && (
            <div className="flex items-center gap-3 text-sm text-ink-700">
              <span
                aria-hidden
                className="inline-block h-3 w-3 animate-pulse rounded-full bg-ink-900"
              />
              <span>抽出中...</span>
            </div>
          )}
          {phase === "done" && (
            <div className="flex items-start gap-3 text-sm text-ink-700">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white"
              >
                ✓
              </span>
              <div>
                <div className="font-medium text-ink-900">完了しました</div>
                <p className="mt-1 text-ink-500">
                  {mode === "stub"
                    ? "APIキーが未設定のため、お試し用の固定パターンで生成しました。APIキーを設定すると、よりあなた向きの内容になりやすくなります。"
                    : mode === "stub_due_to_quota"
                      ? "入力は保持されたままスタブで生成しました（下の注意を参照）。quota 回復後に再生成すると、通常の AI 抽出に戻せます。"
                      : "AI による抽出が完了しました。"}
                </p>
                {completionWarning ? (
                  <p className="mt-2 rounded-md border border-signal-should/40 bg-signal-should/10 px-3 py-2 text-xs font-medium leading-relaxed text-signal-should">
                    {completionWarning}
                  </p>
                ) : null}
              </div>
            </div>
          )}
          {phase === "error" && canGenerate && (
            <div className="rounded-md border border-signal-must/30 bg-signal-must/5 px-4 py-3 text-sm text-signal-must">
              <strong className="block mb-1">生成に失敗しました</strong>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">
                {error}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-600">
                用語やステータスの意味が曖昧なときは{" "}
                <Link
                  href="/help/glossary"
                  className="text-accent underline-offset-2 hover:underline"
                >
                  用語ミニヘルプ
                </Link>{" "}
                を参照してください。
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 flex items-center justify-between">
        {canGenerate ? (
          <Button variant="ghost" onClick={() => router.push("/builder/scenarios")}>
            ← シナリオに戻る
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => router.push("/onboarding")}>
              基本プロフィールへ
            </Button>
            <Button variant="ghost" onClick={() => router.push("/builder/personality")}>
              ステップ1へ
            </Button>
            <Button variant="ghost" onClick={() => router.push("/builder/interview")}>
              ステップ2へ
            </Button>
            <Button variant="ghost" onClick={() => router.push("/builder/scenarios")}>
              ステップ3へ
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          {phase === "done" && canGenerate && (
            <Button variant="ghost" onClick={() => run()}>
              再生成する
            </Button>
          )}
          {phase === "error" && canGenerate && (
            <Button variant="secondary" onClick={() => run()}>
              再試行
            </Button>
          )}
          <Button size="lg" disabled={phase !== "done"} onClick={handleNext}>
            編集・出力へ →
          </Button>
        </div>
      </div>
    </WorkspaceShell>
  );
}
