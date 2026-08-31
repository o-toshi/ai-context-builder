import type {
  PublisherEmotion,
  PublisherMode,
  PublisherPlatform,
  PublisherPurpose,
} from "@/types/publisher";

interface PublisherModeOption {
  value: PublisherMode;
  label: string;
  disabled: boolean;
}

interface PublisherEmotionOption {
  value: PublisherEmotion;
  label: string;
  emoji: string;
}

interface PublisherPurposeOption {
  value: PublisherPurpose;
  label: string;
}

interface PublisherPlatformOption {
  value: PublisherPlatform;
  label: string;
}

export const PUBLISHER_MODES = [
  { value: "life", label: "ライフ", disabled: false },
  { value: "project", label: "プロジェクト（準備中）", disabled: true },
] as const satisfies readonly PublisherModeOption[];

export const PUBLISHER_EMOTIONS = [
  { value: "joy", label: "喜び", emoji: "😊" },
  { value: "gratitude", label: "感謝", emoji: "😌" },
  { value: "insight", label: "気付き", emoji: "🤔" },
  { value: "passion", label: "情熱", emoji: "🔥" },
  { value: "challenge", label: "挑戦", emoji: "💪" },
  { value: "sadness", label: "悲しみ", emoji: "😢" },
  { value: "issue", label: "問題提起", emoji: "😠" },
  { value: "support", label: "応援", emoji: "❤️" },
] as const satisfies readonly PublisherEmotionOption[];

export const PUBLISHER_PURPOSES = [
  { value: "empathy", label: "共感してほしい" },
  { value: "awareness", label: "知ってほしい" },
  { value: "reflection", label: "考えてほしい" },
  { value: "action", label: "行動してほしい" },
  { value: "encouragement", label: "応援したい" },
  { value: "record", label: "記録として残したい" },
] as const satisfies readonly PublisherPurposeOption[];

export const PUBLISHER_PLATFORMS = [
  { value: "x", label: "X" },
  { value: "threads", label: "Threads" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "note", label: "note告知" },
] as const satisfies readonly PublisherPlatformOption[];

export const PUBLISHER_PLATFORM_LABELS: Record<PublisherPlatform, string> = {
  x: "X",
  threads: "Threads",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  note: "note告知",
};
