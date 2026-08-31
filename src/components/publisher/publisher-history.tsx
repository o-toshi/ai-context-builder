"use client";

import { useState } from "react";
import { GeneratedPostCard } from "@/components/publisher/generated-post-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PUBLISHER_PLATFORM_LABELS } from "@/data/publisher-options";
import { cn } from "@/lib/utils";
import { usePublisherStore } from "@/store/publisher-store";
import type { GeneratedPost, PostHistory } from "@/types/publisher";

interface PublisherHistoryProps {
  isReady: boolean;
  initialHistoryId: string | null;
  onCreatePost: () => void;
}

type CopyStatus = "idle" | "copied" | "failed";

function historyTitle(history: PostHistory): string {
  const date = new Date(history.createdAt);
  if (Number.isNaN(date.getTime())) return "保存した投稿";
  return `${date.getMonth() + 1}月${date.getDate()}日の投稿`;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新日時不明";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function messageExcerpt(message: string): string {
  const normalized = message.replace(/\s+/gu, " ").trim();
  return normalized.length > 70 ? `${normalized.slice(0, 70)}…` : normalized;
}

export function PublisherHistory({
  isReady,
  initialHistoryId,
  onCreatePost,
}: PublisherHistoryProps) {
  const histories = usePublisherStore((state) => state.histories);
  const updateGeneratedPostText = usePublisherStore(
    (state) => state.updateGeneratedPostText,
  );
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    initialHistoryId,
  );
  const [copyStatuses, setCopyStatuses] = useState<
    Record<string, CopyStatus>
  >({});

  const selectedHistory =
    histories.find((history) => history.id === selectedHistoryId) ??
    histories[0] ??
    null;

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
    <section aria-labelledby="publisher-history-title">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">ライフ</p>
          <h1
            id="publisher-history-title"
            className="mt-2 text-3xl font-semibold tracking-tightish text-ink-900 sm:text-4xl"
          >
            保存した投稿
          </h1>
          <p className="mt-3 text-base leading-relaxed text-ink-500">
            明示的に保存した投稿案だけを、SNS一式で振り返れます。
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={onCreatePost}>
          新しい投稿案をつくる
        </Button>
      </div>

      {!isReady ? (
        <Card>
          <CardContent className="p-6 text-sm text-ink-500">
            保存した投稿を読み込んでいます。
          </CardContent>
        </Card>
      ) : histories.length === 0 ? (
        <Card>
          <CardContent className="p-6 sm:p-8">
            <p className="font-medium text-ink-900">
              保存した投稿はまだありません
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              生成した投稿案で「この一式を保存」を選ぶと、ここに追加されます。
            </p>
            <Button type="button" className="mt-5" onClick={onCreatePost}>
              投稿案をつくる
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside aria-labelledby="publisher-history-list-title">
            <h2
              id="publisher-history-list-title"
              className="mb-3 text-sm font-semibold text-ink-700"
            >
              履歴一覧
            </h2>
            <div className="space-y-2">
              {histories.map((history) => {
                const selected = selectedHistory?.id === history.id;
                return (
                  <button
                    key={history.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedHistoryId(history.id)}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2",
                      selected
                        ? "border-accent bg-accent-soft/60"
                        : "border-ink-200 bg-white hover:border-ink-400 hover:bg-ink-50",
                    )}
                  >
                    <span className="block font-medium text-ink-900">
                      {historyTitle(history)}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-500">
                      {messageExcerpt(history.input.message)}
                    </span>
                    <span className="mt-3 flex flex-wrap gap-1.5">
                      {history.generatedPosts.map((post) => (
                        <span
                          key={post.id}
                          className="rounded-full bg-white px-2 py-0.5 text-xs text-ink-600"
                        >
                          {PUBLISHER_PLATFORM_LABELS[post.platform]}
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {selectedHistory && (
            <article aria-labelledby="publisher-history-detail-title">
              <Card className="mb-4">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2
                        id="publisher-history-detail-title"
                        className="text-xl font-semibold tracking-tightish text-ink-900"
                      >
                        {historyTitle(selectedHistory)}
                      </h2>
                      <p className="mt-1 text-xs text-ink-400">
                        更新：{formatUpdatedAt(selectedHistory.updatedAt)}
                      </p>
                    </div>
                    <p className="text-sm text-ink-500">
                      編集内容は自動で上書き保存されます。
                    </p>
                  </div>
                  <div className="mt-5 rounded-lg bg-ink-50 p-4">
                    <p className="text-xs font-semibold text-ink-500">
                      伝えたこと
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
                      {selectedHistory.input.message}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:grid-cols-2">
                {selectedHistory.generatedPosts.map((post) => (
                  <GeneratedPostCard
                    key={post.id}
                    post={post}
                    copyStatus={copyStatuses[post.id] ?? "idle"}
                    onTextChange={(postId, text) =>
                      updateGeneratedPostText(
                        selectedHistory.id,
                        postId,
                        text,
                      )
                    }
                    onCopy={copyPost}
                  />
                ))}
              </div>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
