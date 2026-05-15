"use client";

/**
 * 音声インタビュー（Step 2）。
 *
 * MVP では UI スケルトン + 「テキストで代用入力」 + 「録音/文字起こしは M2 で実装」
 * の構成にしている。プロソディ抽出（Gemini Audio Input）は API 側に既に
 * 実装済み (/api/transcribe) なので、後段で MediaRecorder を繋ぐだけで動く。
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { INTERVIEW_QUESTIONS } from "@/data/interview-questions";

function starterTemplate(questionId: string): string {
  if (questionId === "i_uzai_01") {
    return [
      "最近うざいと感じた返答:",
      "実際の言い回し:",
      "なぜ嫌だったか:",
      "代わりにどう言ってほしいか:",
    ].join("\n");
  }
  if (questionId === "i_rules_01") {
    return [
      "絶対に守らせるルール1:",
      "絶対に守らせるルール2:",
      "絶対に守らせるルール3:",
      "守られないと困る理由:",
    ].join("\n");
  }
  if (questionId === "i_decide_01") {
    return [
      "即決する条件:",
      "持ち帰る条件:",
      "判断の線引き:",
      "最近の具体例:",
    ].join("\n");
  }
  if (questionId === "i_fire_01") {
    return [
      "即解雇したくなる振る舞い:",
      "具体的な言い回し:",
      "最高のアシスタントの一言:",
      "その理由:",
    ].join("\n");
  }
  return [
    "最近の具体エピソード:",
    "そのとき何を優先したか:",
    "最終的な判断理由:",
  ].join("\n");
}

export default function InterviewPage() {
  const router = useRouter();
  const [showUnansweredFirst, setShowUnansweredFirst] = useState(true);
  const [showOnlyUnanswered, setShowOnlyUnanswered] = useState(false);
  const [activeRecordingQuestionId, setActiveRecordingQuestionId] = useState<
    string | null
  >(null);
  const [recordingSecondsLeft, setRecordingSecondsLeft] = useState(60);
  const [statusByQuestion, setStatusByQuestion] = useState<
    Record<string, "idle" | "recording" | "transcribing" | "error">
  >({});
  const [errorByQuestion, setErrorByQuestion] = useState<Record<string, string>>({});
  const [lastTranscriptByQuestion, setLastTranscriptByQuestion] = useState<
    Record<string, string>
  >({});
  const transcribeAttemptsRef = useRef<Record<string, number>>({});
  const transcribeTimerRef = useRef<number | null>(null);
  const stopRecordingRef = useRef<(questionId: string) => void>(() => {});
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const clips = useBuilderStore((s) => s.input.interviewClips);
  const upsertClip = useBuilderStore((s) => s.upsertInterviewClip);
  const markCompleted = useBuilderStore((s) => s.markCompleted);
  const goTo = useBuilderStore((s) => s.goTo);

  const totalQuestions = INTERVIEW_QUESTIONS.length;
  const answeredCount = INTERVIEW_QUESTIONS.filter(
    (q) => (clips.find((c) => c.questionId === q.id)?.transcript ?? "").trim().length > 0,
  ).length;
  const allDone = answeredCount === totalQuestions;

  const transcriptOf = useCallback(
    (id: string) => clips.find((c) => c.questionId === id)?.transcript ?? "",
    [clips],
  );

  const orderedQuestions = useMemo(() => {
    if (!showUnansweredFirst) return INTERVIEW_QUESTIONS;
    return [...INTERVIEW_QUESTIONS].sort((a, b) => {
      const aAnswered = transcriptOf(a.id).trim().length > 0 ? 1 : 0;
      const bAnswered = transcriptOf(b.id).trim().length > 0 ? 1 : 0;
      return aAnswered - bAnswered;
    });
  }, [showUnansweredFirst, transcriptOf]);

  const questionOrderMap = useMemo(
    () =>
      new Map(
        INTERVIEW_QUESTIONS.map((q, index) => [q.id, index + 1] as const),
      ),
    [],
  );

  const visibleQuestions = useMemo(() => {
    if (!showOnlyUnanswered) return orderedQuestions;
    return orderedQuestions.filter(
      (q) => transcriptOf(q.id).trim().length === 0,
    );
  }, [showOnlyUnanswered, orderedQuestions, transcriptOf]);

  const firstUnansweredId = useMemo(() => {
    const target = orderedQuestions.find((q) => transcriptOf(q.id).trim().length === 0);
    return target?.id;
  }, [orderedQuestions, transcriptOf]);

  const jumpToNextUnanswered = () => {
    if (!firstUnansweredId) return;
    const node = questionRefs.current[firstUnansweredId];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      const textarea = node.querySelector("textarea") as HTMLTextAreaElement | null;
      textarea?.focus();
    }, 80);
  };

  const fillAllEmptyWithTemplates = () => {
    INTERVIEW_QUESTIONS.forEach((q) => {
      const current = transcriptOf(q.id);
      if (current.trim()) return;
      upsertClip({
        questionId: q.id,
        transcript: starterTemplate(q.id),
      });
    });
  };

  const setQuestionStatus = (
    questionId: string,
    status: "idle" | "recording" | "transcribing" | "error",
  ) => {
    setStatusByQuestion((prev) => ({ ...prev, [questionId]: status }));
  };

  const applyTranscribeResult = (questionId: string) => {
    const attempt = (transcribeAttemptsRef.current[questionId] ?? 0) + 1;
    transcribeAttemptsRef.current[questionId] = attempt;
    if (attempt === 1) {
      setQuestionStatus(questionId, "error");
      setErrorByQuestion((prev) => ({
        ...prev,
        [questionId]:
          "変換に失敗しました。接続を確認して「再試行」を押してください。",
      }));
      return;
    }
    const current = transcriptOf(questionId);
    upsertClip({
      questionId,
      transcript:
        current.trim().length > 0
          ? current
          : "（音声入力の下書き）結論→理由→次の一手の順で回答してください。",
    });
    setQuestionStatus(questionId, "idle");
    setErrorByQuestion((prev) => ({ ...prev, [questionId]: "" }));
  };

  const startRecording = (questionId: string) => {
    if (activeRecordingQuestionId && activeRecordingQuestionId !== questionId) return;
    setLastTranscriptByQuestion((prev) => ({
      ...prev,
      [questionId]: transcriptOf(questionId),
    }));
    setErrorByQuestion((prev) => ({ ...prev, [questionId]: "" }));
    setRecordingSecondsLeft(60);
    setActiveRecordingQuestionId(questionId);
    setQuestionStatus(questionId, "recording");
  };

  const stopRecording = (questionId: string) => {
    if (activeRecordingQuestionId !== questionId) return;
    setActiveRecordingQuestionId(null);
    setQuestionStatus(questionId, "transcribing");
    if (transcribeTimerRef.current) {
      window.clearTimeout(transcribeTimerRef.current);
    }
    transcribeTimerRef.current = window.setTimeout(() => {
      applyTranscribeResult(questionId);
    }, 900);
  };

  stopRecordingRef.current = stopRecording;

  const retryTranscribe = (questionId: string) => {
    setQuestionStatus(questionId, "transcribing");
    setErrorByQuestion((prev) => ({ ...prev, [questionId]: "" }));
    if (transcribeTimerRef.current) {
      window.clearTimeout(transcribeTimerRef.current);
    }
    transcribeTimerRef.current = window.setTimeout(() => {
      applyTranscribeResult(questionId);
    }, 700);
  };

  const clearQuestionTranscript = (questionId: string) => {
    const current = transcriptOf(questionId);
    setLastTranscriptByQuestion((prev) => ({ ...prev, [questionId]: current }));
    upsertClip({ questionId, transcript: "" });
    setQuestionStatus(questionId, "idle");
    setErrorByQuestion((prev) => ({ ...prev, [questionId]: "" }));
  };

  const restoreLastTranscript = (questionId: string) => {
    const value = lastTranscriptByQuestion[questionId];
    if (!value) return;
    upsertClip({ questionId, transcript: value });
    setQuestionStatus(questionId, "idle");
    setErrorByQuestion((prev) => ({ ...prev, [questionId]: "" }));
  };

  useEffect(() => {
    if (!activeRecordingQuestionId) return;
    const timer = window.setInterval(() => {
      setRecordingSecondsLeft((prev) => {
        if (prev <= 1) {
          stopRecordingRef.current(activeRecordingQuestionId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeRecordingQuestionId]);

  useEffect(() => {
    return () => {
      if (transcribeTimerRef.current) {
        window.clearTimeout(transcribeTimerRef.current);
      }
    };
  }, []);

  const handleNext = () => {
    markCompleted("interview");
    goTo("scenarios");
    router.push("/builder/scenarios");
  };

  return (
    <WorkspaceShell
      current="interview"
      title="Step 2 — 音声インタビュー"
      subtitle="録音された声のトーン・話速・断定度から、文字には現れない『あなた本人らしさ』を抽出します。MVP ではテキスト入力で代用可能です。"
    >
      <Card className="mb-6 border-dashed bg-ink-50">
        <CardContent>
          <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink-600 md:flex-row md:items-center md:justify-between">
            <div>
              <strong className="text-ink-900">音声録音は M2 で実装予定。</strong>
              <span className="ml-1">
                現在はテキスト入力で代用できます（AIで文字起こし＋プロソディ抽出する API は既に動作可能です）。
              </span>
            </div>
            <Link
              href="/help/glossary"
              className="text-xs text-accent underline-offset-2 hover:underline"
            >
              用語ヘルプ
            </Link>
            <span className="text-xs font-mono text-ink-400">
              {answeredCount} / {totalQuestions} answered
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
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
              onClick={fillAllEmptyWithTemplates}
              disabled={answeredCount === totalQuestions}
            >
              空欄にテンプレ一括挿入
            </Button>
            <span className="text-xs text-ink-500">
              回答済み: {answeredCount}件 / 未回答: {totalQuestions - answeredCount}件
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
          const current = transcriptOf(q.id);
          const qStatus = statusByQuestion[q.id] ?? "idle";
          const isRecording = activeRecordingQuestionId === q.id;
          const originalOrder = questionOrderMap.get(q.id) ?? 0;
          const isAnsweredCard = current.trim().length > 0;
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
                    <div>
                      <CardTitle className="font-normal leading-relaxed">
                        {q.prompt}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        推奨時間: {q.recommendedSec}秒程度
                      </CardDescription>
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
                <textarea
                  className="w-full rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm leading-relaxed text-ink-900 outline-none transition focus:border-ink-900 focus:ring-2 focus:ring-ink-900/10"
                  rows={4}
                  placeholder="（録音する代わりに）思ったことをそのまま書いてください。フィラーや言い淀みも含めて構いません。"
                  value={current}
                  onChange={(e) =>
                    upsertClip({
                      questionId: q.id,
                      transcript: e.target.value,
                    })
                  }
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      upsertClip({
                        questionId: q.id,
                        transcript: current.trim() ? current : starterTemplate(q.id),
                      })
                    }
                  >
                    書き出しテンプレを挿入
                  </Button>
                  {isRecording ? (
                    <Button size="sm" variant="secondary" onClick={() => stopRecording(q.id)}>
                      ■ 停止（残り{recordingSecondsLeft}秒）
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={Boolean(activeRecordingQuestionId)}
                      onClick={() => startRecording(q.id)}
                    >
                      🎙 録音開始（最大60秒）
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!current.trim()}
                    onClick={() => clearQuestionTranscript(q.id)}
                  >
                    録音やり直し
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!lastTranscriptByQuestion[q.id]}
                    onClick={() => restoreLastTranscript(q.id)}
                  >
                    直近復元
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={qStatus !== "error"}
                    onClick={() => retryTranscribe(q.id)}
                  >
                    再試行
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!current.trim()}
                    onClick={() => clearQuestionTranscript(q.id)}
                  >
                    この質問をクリア
                  </Button>
                  <span className="text-xs font-mono text-ink-400">
                    {current.trim().length} chars
                  </span>
                  <span
                    className={
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                      (qStatus === "recording"
                        ? "border-signal-should/30 bg-signal-should/10 text-signal-should"
                        : qStatus === "transcribing"
                          ? "border-accent/30 bg-accent/10 text-accent"
                          : qStatus === "error"
                            ? "border-signal-must/30 bg-signal-must/10 text-signal-must"
                            : "border-ink-200 bg-ink-50 text-ink-500")
                    }
                  >
                    {qStatus === "recording"
                      ? "録音中"
                      : qStatus === "transcribing"
                        ? "変換中"
                        : qStatus === "error"
                          ? "失敗"
                          : "待機"}
                  </span>
                  <span className="text-xs text-ink-400">
                    Web Audio + Gemini Audio Input で接続予定
                  </span>
                  {errorByQuestion[q.id] && (
                    <p className="w-full text-xs text-signal-must">
                      {errorByQuestion[q.id]}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push("/builder/personality")}
        >
          ← 性格診断に戻る
        </Button>
        <Button size="lg" disabled={!allDone} onClick={handleNext}>
          {allDone ? "シナリオへ →" : `あと ${totalQuestions - answeredCount} 問`}
        </Button>
      </div>
    </WorkspaceShell>
  );
}
