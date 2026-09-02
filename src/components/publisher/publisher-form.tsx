import { useLayoutEffect, useRef, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PUBLISHER_EMOTIONS,
  PUBLISHER_PLATFORMS,
  PUBLISHER_PURPOSES,
} from "@/data/publisher-options";
import { cn } from "@/lib/utils";
import type {
  PublisherEmotion,
  PublisherPlatform,
  PublisherPurpose,
} from "@/types/publisher";

interface PublisherFormProps {
  message: string;
  emotion: PublisherEmotion | null;
  purpose: PublisherPurpose | null;
  hashtagInput: string;
  platforms: PublisherPlatform[];
  isSubmitting: boolean;
  canSubmit: boolean;
  onMessageChange: (value: string) => void;
  onEmotionChange: (value: PublisherEmotion) => void;
  onPurposeChange: (value: PublisherPurpose) => void;
  onHashtagInputChange: (value: string) => void;
  onPlatformToggle: (value: PublisherPlatform) => void;
  onSubmit: () => void;
}

const CHIP_CLASS =
  "min-h-10 rounded-full border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2";
const MESSAGE_MAX_HEIGHT_PX = 384;

function StepLabel({ number, children }: { number: number; children: string }) {
  return (
    <span className="flex items-center gap-2 text-base font-semibold text-ink-900">
      <span
        aria-hidden="true"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-xs text-white"
      >
        {number}
      </span>
      {children}
    </span>
  );
}

export function PublisherForm({
  message,
  emotion,
  purpose,
  hashtagInput,
  platforms,
  isSubmitting,
  canSubmit,
  onMessageChange,
  onEmotionChange,
  onPurposeChange,
  onHashtagInputChange,
  onPlatformToggle,
  onSubmit,
}: PublisherFormProps) {
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = messageRef.current;
    if (!element) return;

    element.style.height = "auto";
    const nextHeight = Math.min(element.scrollHeight, MESSAGE_MAX_HEIGHT_PX);
    element.style.height = `${nextHeight}px`;
    element.style.overflowY =
      element.scrollHeight > MESSAGE_MAX_HEIGHT_PX ? "auto" : "hidden";
  }, [message]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit && !isSubmitting) onSubmit();
  };

  return (
    <Card>
      <CardContent className="p-5 sm:p-7">
        <form className="space-y-8" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="publisher-message">
              <StepLabel number={1}>伝えたいこと</StepLabel>
            </label>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              まとまっていなくても大丈夫です。URLもそのまま含められます。
            </p>
            <textarea
              ref={messageRef}
              id="publisher-message"
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              placeholder="今日あったこと、気付いたこと、誰かに届けたい想いを、そのまま書いてください。"
              rows={3}
              maxLength={4000}
              required
              className="mt-3 w-full resize-none rounded-xl border border-ink-200 bg-white px-4 py-3 text-base leading-relaxed text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-ink-500 focus:ring-2 focus:ring-ink-100"
            />
          </div>

          <fieldset>
            <legend>
              <StepLabel number={2}>今の気持ち</StepLabel>
            </legend>
            <p className="mt-2 text-sm text-ink-500">
              いちばん近いものを選んでください。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PUBLISHER_EMOTIONS.map((option) => {
                const selected = emotion === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onEmotionChange(option.value)}
                    className={cn(
                      CHIP_CLASS,
                      selected
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-ink-200 bg-white text-ink-700 hover:border-ink-400 hover:bg-ink-50",
                    )}
                  >
                    <span aria-hidden="true">{option.emoji}</span>
                    <span className="ml-1.5">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend>
              <StepLabel number={3}>どう伝えたいですか？</StepLabel>
            </legend>
            <p className="mt-2 text-sm text-ink-500">
              今回の目的に近いものを選んでください。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PUBLISHER_PURPOSES.map((option) => {
                const selected = purpose === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onPurposeChange(option.value)}
                    className={cn(
                      CHIP_CLASS,
                      selected
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-ink-200 bg-white text-ink-700 hover:border-ink-400 hover:bg-ink-50",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <details className="group rounded-xl border border-dashed border-ink-200 bg-ink-50/60">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
              <span>ハッシュタグを追加（任意）</span>
              <span aria-hidden="true" className="text-ink-400">
                {hashtagInput.trim() ? "✓" : "＋"}
              </span>
            </summary>
            <div className="border-t border-ink-100 px-4 pb-4 pt-3">
              <label
                htmlFor="publisher-hashtags"
                className="text-sm text-ink-500"
              >
                使いたいものだけ入力してください。
              </label>
              <input
                id="publisher-hashtags"
                type="text"
                value={hashtagInput}
                onChange={(event) => onHashtagInputChange(event.target.value)}
                placeholder="例：HUE, 日々の気付き"
                autoComplete="off"
                className="mt-2 h-11 w-full rounded-xl border border-ink-200 bg-white px-4 text-base text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-ink-500 focus:ring-2 focus:ring-ink-100"
              />
              <p className="mt-2 text-xs text-ink-400">
                #は付けても付けなくても構いません。空白やカンマで区切れます。
              </p>
            </div>
          </details>

          <fieldset>
            <legend>
              <StepLabel number={4}>投稿先SNS</StepLabel>
            </legend>
            <p className="mt-2 text-sm text-ink-500">
              投稿案が必要な場所を選んでください。複数選べます。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PUBLISHER_PLATFORMS.map((option) => {
                const selected = platforms.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onPlatformToggle(option.value)}
                    className={cn(
                      CHIP_CLASS,
                      selected
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-ink-200 bg-white text-ink-700 hover:border-ink-400 hover:bg-ink-50",
                    )}
                  >
                    {selected && <span aria-hidden="true">✓</span>}
                    <span className={selected ? "ml-1.5" : undefined}>
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="border-t border-ink-100 pt-6">
            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit || isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "投稿案を整えています" : "投稿案をつくる"}
            </Button>
            {!canSubmit && !isSubmitting && (
              <p className="mt-3 text-sm text-ink-500">
                伝えたいこと・気持ち・目的・投稿先を選ぶと作れます。
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
