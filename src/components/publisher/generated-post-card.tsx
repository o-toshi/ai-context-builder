import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PUBLISHER_PLATFORM_LABELS } from "@/data/publisher-options";
import type { GeneratedPost } from "@/types/publisher";

interface GeneratedPostCardProps {
  post: GeneratedPost;
  copyStatus: "idle" | "copied" | "failed";
  onTextChange: (postId: string, value: string) => void;
  onCopy: (post: GeneratedPost) => void;
}

export function GeneratedPostCard({
  post,
  copyStatus,
  onTextChange,
  onCopy,
}: GeneratedPostCardProps) {
  const label = PUBLISHER_PLATFORM_LABELS[post.platform];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <CardTitle>{label}</CardTitle>
          <p className="mt-1 text-xs text-ink-400">
            {post.characterCount}文字（概算）
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onCopy(post)}
          aria-label={`${label}の投稿本文をコピー`}
        >
          {copyStatus === "copied" ? "コピーしました" : "コピー"}
        </Button>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <label htmlFor={`publisher-post-${post.id}`} className="sr-only">
          {label}の投稿本文
        </label>
        <textarea
          id={`publisher-post-${post.id}`}
          value={post.text}
          onChange={(event) => onTextChange(post.id, event.target.value)}
          rows={9}
          className="w-full resize-y rounded-lg border border-ink-200 bg-ink-50 px-3 py-3 text-sm leading-7 text-ink-900 outline-none transition focus:border-ink-500 focus:bg-white focus:ring-2 focus:ring-ink-100"
        />
        <p
          className="mt-2 min-h-5 text-xs text-ink-500"
          role="status"
          aria-live="polite"
        >
          {copyStatus === "failed"
            ? "コピーできませんでした。本文を選択してコピーしてください。"
            : "自由に編集できます。"}
        </p>
      </CardContent>
    </Card>
  );
}
