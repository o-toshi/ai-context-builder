"use client";

import { useEffect, useRef, useState } from "react";
import { GeneratedPostCard } from "@/components/publisher/generated-post-card";
import { PublisherForm } from "@/components/publisher/publisher-form";
import { PublisherHistory } from "@/components/publisher/publisher-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  countPublisherCharacters,
  extractUrls,
  normalizeHashtags,
} from "@/lib/publisher/input-utils";
import { cn } from "@/lib/utils";
import { usePublisherStore } from "@/store/publisher-store";
import type {
  GeneratedPost,
  GeneratePostsRequest,
  PostHistory,
  PostInput,
  PublisherEmotion,
  PublisherPlatform,
  PublisherPurpose,
} from "@/types/publisher";

interface PublisherApiSuccess {
  ok: true;
  data: {
    provider: string;
    model: string;
    generatedPosts: GeneratedPost[];
  };
}

interface PublisherApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    retryAfterMs?: number;
  };
  inputPreserved: true;
}

interface DisplayError {
  message: string;
  retryable: boolean;
}

type CopyStatus = "idle" | "copied" | "failed";
type PublisherView = "create" | "history";
type SaveStatus = "idle" | "saved" | "updated";

function createInputId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `publisher-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createHistoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `publisher-history-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function isPublisherApiFailure(value: unknown): value is PublisherApiFailure {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PublisherApiFailure>;
  return (
    candidate.ok === false &&
    !!candidate.error &&
    typeof candidate.error.message === "string" &&
    typeof candidate.error.retryable === "boolean"
  );
}

function isPublisherApiSuccess(value: unknown): value is PublisherApiSuccess {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PublisherApiSuccess>;
  return (
    candidate.ok === true &&
    !!candidate.data &&
    Array.isArray(candidate.data.generatedPosts)
  );
}

export function PublisherWorkspace() {
  const histories = usePublisherStore((state) => state.histories);
  const upsertHistory = usePublisherStore((state) => state.upsertHistory);
  const [activeView, setActiveView] = useState<PublisherView>("create");
  const [historyReady, setHistoryReady] = useState(false);
  const [historyTargetId, setHistoryTargetId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [emotion, setEmotion] = useState<PublisherEmotion | null>(null);
  const [purpose, setPurpose] = useState<PublisherPurpose | null>(null);
  const [hashtagInput, setHashtagInput] = useState("");
  const [platforms, setPlatforms] = useState<PublisherPlatform[]>([]);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [generatedInput, setGeneratedInput] = useState<PostInput | null>(null);
  const [savedHistoryId, setSavedHistoryId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<DisplayError | null>(null);
  const [copyStatuses, setCopyStatuses] = useState<
    Record<string, CopyStatus>
  >({});
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve(usePublisherStore.persist.rehydrate()).finally(() => {
      if (active) setHistoryReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const canSubmit =
    message.trim().length > 0 &&
    emotion !== null &&
    purpose !== null &&
    platforms.length > 0;

  const clearError = () => setError(null);

  const togglePlatform = (platform: PublisherPlatform) => {
    clearError();
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    );
  };

  const generate = async () => {
    if (!canSubmit || !emotion || !purpose || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setCopyStatuses({});

    const requestBody: GeneratePostsRequest = {
      input: {
        id: createInputId(),
        mode: "life",
        message: message.trim(),
        emotion,
        purpose,
        hashtags: normalizeHashtags(hashtagInput),
        platforms,
        sourceUrls: extractUrls(message),
        createdAt: new Date().toISOString(),
      },
    };

    try {
      const response = await fetch("/api/publisher/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok || !isPublisherApiSuccess(payload)) {
        if (isPublisherApiFailure(payload)) {
          setError({
            message: payload.error.message,
            retryable: payload.error.retryable,
          });
        } else {
          setError({
            message:
              "投稿案を受け取れませんでした。入力は残っているため、そのまま再試行できます。",
            retryable: true,
          });
        }
        return;
      }

      setGeneratedPosts(payload.data.generatedPosts);
      setGeneratedInput(requestBody.input);
      setSavedHistoryId(null);
      setSaveStatus("idle");
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch {
      setError({
        message:
          "通信に問題があり、投稿案を受け取れませんでした。接続を確認して再試行してください。",
        retryable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePostText = (postId: string, value: string) => {
    setSaveStatus("idle");
    setGeneratedPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              text: value,
              characterCount: countPublisherCharacters(value),
              updatedAt: new Date().toISOString(),
            }
          : post,
      ),
    );
  };

  const saveGeneratedPosts = () => {
    if (!generatedInput || generatedPosts.length === 0) return;

    const now = new Date().toISOString();
    const existingHistory = savedHistoryId
      ? histories.find((history) => history.id === savedHistoryId)
      : undefined;
    const historyId = existingHistory?.id ?? createHistoryId();
    const history: PostHistory = {
      id: historyId,
      input: {
        ...generatedInput,
        hashtags: [...generatedInput.hashtags],
        platforms: [...generatedInput.platforms],
        sourceUrls: [...generatedInput.sourceUrls],
      },
      generatedPosts: generatedPosts.map((post) => ({ ...post })),
      status: "saved",
      createdAt: existingHistory?.createdAt ?? now,
      updatedAt: now,
    };

    upsertHistory(history);
    setSavedHistoryId(historyId);
    setHistoryTargetId(historyId);
    setSaveStatus(existingHistory ? "updated" : "saved");
  };

  const copyPost = async (post: GeneratedPost) => {
    try {
      await navigator.clipboard.writeText(post.text);
      setCopyStatuses((current) => ({ ...current, [post.id]: "copied" }));
      window.setTimeout(() => {
        setCopyStatuses((current) => ({ ...current, [post.id]: "idle" }));
      }, 2_000);
    } catch {
      setCopyStatuses((current) => ({ ...current, [post.id]: "failed" }));
    }
  };

  return (
    <div>
      <div
        aria-label="Publisherメニュー"
        className="mb-8 flex max-w-max gap-1 rounded-lg bg-ink-100 p-1"
      >
        <button
          type="button"
          aria-pressed={activeView === "create"}
          onClick={() => setActiveView("create")}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2",
            activeView === "create"
              ? "bg-white text-ink-900 shadow-sm"
              : "text-ink-600 hover:text-ink-900",
          )}
        >
          投稿をつくる
        </button>
        <button
          type="button"
          aria-pressed={activeView === "history"}
          onClick={() => setActiveView("history")}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2",
            activeView === "history"
              ? "bg-white text-ink-900 shadow-sm"
              : "text-ink-600 hover:text-ink-900",
          )}
        >
          保存した投稿{historyReady ? `（${histories.length}）` : ""}
        </button>
      </div>

      {activeView === "history" ? (
        <PublisherHistory
          isReady={historyReady}
          initialHistoryId={historyTargetId}
          onCreatePost={() => setActiveView("create")}
        />
      ) : (
        <>
          <section className="mx-auto max-w-3xl">
            <div className="mb-6 sm:mb-8">
              <p className="text-sm font-semibold text-accent">ライフ</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tightish text-ink-900 sm:text-4xl">
                今日は、何を届けますか？
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-500">
                今の言葉を中心に、SNSごとの投稿案を整えます。
              </p>
            </div>

            <PublisherForm
              message={message}
              emotion={emotion}
              purpose={purpose}
              hashtagInput={hashtagInput}
              platforms={platforms}
              isSubmitting={isSubmitting}
              canSubmit={canSubmit}
              onMessageChange={(value) => {
                clearError();
                setMessage(value);
              }}
              onEmotionChange={(value) => {
                clearError();
                setEmotion(value);
              }}
              onPurposeChange={(value) => {
                clearError();
                setPurpose(value);
              }}
              onHashtagInputChange={(value) => {
                clearError();
                setHashtagInput(value);
              }}
              onPlatformToggle={togglePlatform}
              onSubmit={generate}
            />

            <div className="mt-6" aria-live="polite">
              {isSubmitting && (
                <Card className="border-accent/20 bg-accent-soft/40">
                  <CardContent className="flex items-start gap-3 p-5">
                    <span
                      aria-hidden="true"
                      className="mt-1 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent"
                    />
                    <div>
                      <p className="font-medium text-ink-900">
                        言葉の芯を保ちながら、投稿先ごとの表現を整えています。
                      </p>
                      <p className="mt-1 text-sm text-ink-500">
                        このまま少しお待ちください。
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {error && !isSubmitting && (
                <Card className="border-signal-must/30">
                  <CardContent className="p-5">
                    <p className="font-medium text-ink-900">
                      投稿案をつくれませんでした
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600">
                      {error.message}
                    </p>
                    <p className="mt-2 text-sm text-ink-500">
                      入力内容はそのまま残っています。
                    </p>
                    {error.retryable && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-4"
                        disabled={!canSubmit}
                        onClick={generate}
                      >
                        もう一度試す
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </section>

          {generatedPosts.length > 0 && (
            <section
              ref={resultsRef}
              aria-labelledby="publisher-results-title"
              className="scroll-mt-6 pt-12 sm:pt-16"
            >
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2
                    id="publisher-results-title"
                    className="text-2xl font-semibold tracking-tightish text-ink-900"
                  >
                    投稿案
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">
                    言葉の芯はそのままに、SNSごとの案を並べました。自由に編集して使えます。
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    {savedHistoryId
                      ? "保存済みです。編集後は同じ履歴へ上書き保存できます。"
                      : "「この一式を保存」を選ぶまで、履歴には追加されません。"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <Button
                    type="button"
                    onClick={saveGeneratedPosts}
                    disabled={!generatedInput}
                    className="w-full sm:w-auto"
                  >
                    {savedHistoryId
                      ? "変更を上書き保存"
                      : "この一式を保存"}
                  </Button>
                  {savedHistoryId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveView("history")}
                    >
                      保存した投稿を見る
                    </Button>
                  )}
                </div>
              </div>

              {saveStatus !== "idle" && (
                <p
                  className="mb-4 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent"
                  role="status"
                  aria-live="polite"
                >
                  {saveStatus === "saved"
                    ? "SNS投稿案一式を保存しました。"
                    : "編集した内容を同じ履歴へ上書き保存しました。"}
                </p>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {generatedPosts.map((post) => (
                  <GeneratedPostCard
                    key={post.id}
                    post={post}
                    copyStatus={copyStatuses[post.id] ?? "idle"}
                    onTextChange={updatePostText}
                    onCopy={copyPost}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
