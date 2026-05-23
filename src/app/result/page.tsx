"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button, buttonClassName } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBuilderStore } from "@/store/builder-store";
import {
  ALL_TARGETS,
  renderAllTargets,
  renderForTarget,
} from "@/lib/markdown/render-executable";
import {
  formatClientFetchError,
  formatHttpError,
} from "@/lib/user-facing-errors";
import { IntensityBadge } from "@/components/intensity-badge";
import type {
  ExampleCase,
  ExecutableContext,
  ExportTarget,
  Intensity,
  PriorityGate,
  Rule,
} from "@/types/executable-context";

/** エクスポート欄のタブ順（その他AIは常に末尾） */
const EXPORT_TAB_ORDER: ExportTarget[] = [
  "chatgpt",
  "claude",
  "claude_code",
  "gemini",
  "google_antigravity",
  "cursor",
  "universal_agent",
];

const TARGET_LABEL: Record<ExportTarget, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  claude_code: "Claude Code",
  gemini: "Gemini",
  google_antigravity: "Google Antigravity",
  cursor: "Cursor (AGENTS.md)",
  universal_agent: "その他のAI・AIエージェント",
};
const TARGET_USAGE_HINT: Record<ExportTarget, string> = {
  chatgpt: "会話型の汎用利用に向いています。",
  claude: "長文指示や文章整理に向いています。",
  claude_code: "実装タスク中心の開発運用に向いています。",
  gemini: "Gemini系モデルでの再現確認に向いています。",
  google_antigravity: "Google Antigravity向け運用に向いています。",
  cursor: "Cursor の AGENTS.md 運用に向いています。",
  universal_agent: "ベンダーを固定しない共通運用に向いています。",
};
const TARGET_REASON_TAG: Record<ExportTarget, string> = {
  chatgpt: "会話運用向け",
  claude: "長文整理向け",
  claude_code: "実装運用向け",
  gemini: "Gemini運用向け",
  google_antigravity: "Google運用向け",
  cursor: "Cursor運用向け",
  universal_agent: "ベンダー非依存",
};
const RECOMMENDED_TARGET_STORAGE_KEY = "result:lastRecommendedTarget";
const TEST_REVALIDATION_STORAGE_KEY = "result:pending-test-revalidation";
const PENDING_TEST_CHECKS = [
  { id: "3-4", label: "3-4 比較結果だけクリアが動く" },
  { id: "3-5", label: "3-5 比較結果を保存（.md）が動く" },
  { id: "3-6", label: "3-6 quota時のstub表示が分かりやすい" },
] as const;

const TARGET_FILENAME: Record<ExportTarget, string> = {
  chatgpt: "chatgpt-system-prompt.md",
  claude: "claude-system-prompt.md",
  claude_code: "claude-code-agent-prompt.md",
  gemini: "gemini-system-instruction.md",
  google_antigravity: "google-antigravity-agent-instruction.md",
  cursor: "AGENTS.md",
  universal_agent: "universal-agent-prompt.md",
};

const PRIORITY_WHEN_PLACEHOLDERS = [
  "例: 速度と品質で迷ったら",
  "例: 短期売上と長期信頼で迷ったら",
  "例: 新規獲得と既存顧客対応が競合したら",
];
const PRIORITY_CHOOSE_PLACEHOLDERS = ["例: 速度", "例: 長期信頼", "例: 既存顧客対応"];
const PRIORITY_OVER_PLACEHOLDERS = ["例: 品質", "例: 短期売上", "例: 新規獲得"];
const PRIORITY_RATIONALE_PLACEHOLDERS = [
  "例: まず出して検証した方が学習サイクルが速い",
  "例: 信頼毀損は回復コストが高いため先に守る",
  "例: 既存顧客の継続率が事業安定性に直結する",
];
const RESPONSE_RULE_PLACEHOLDERS = [
  "例: まず結論を1文で示し、その後に理由を3点以内で述べる",
  "例: 否定から入らず、最初に意図を肯定してから改善案を提示する",
  "例: 抽象語を避け、行動レベルの提案に落として回答する",
];
const TABOO_RULE_PLACEHOLDERS = [
  "例: 根拠のない断定表現をしない",
  "例: 相手の努力を否定する言い回しをしない",
  "例: 一般論だけで締めて具体策を出さない回答をしない",
];
const AUTO_FIXABLE_CHECK_IDS = [
  "must-empty",
  "priority-gates-count",
  "priority-gate-fields",
  "examples-count",
  "examples-incomplete",
] as const;
const MANUAL_FIX_TEMPLATES: Record<string, string> = {
  "response-duplicate": "重複ルールは統合し、使い分け条件を1文追加。",
  "taboos-duplicate": "重複禁忌は統合し、禁止理由を短く追記。",
  "weak-expression": "抽象語を行動指示へ置換（順序・文量・条件を明記）。",
};

export default function ResultPage() {
  const context = useBuilderStore((s) => s.context);
  const exports = useBuilderStore((s) => s.exports);
  const setContext = useBuilderStore((s) => s.setContext);
  const setExports = useBuilderStore((s) => s.setExports);
  const profiles = useBuilderStore((s) => s.profiles);
  const currentProfileId = useBuilderStore((s) => s.currentProfileId);

  const [activeTarget, setActiveTarget] = useState<ExportTarget>("chatgpt");
  const [editMode, setEditMode] = useState(false);
  const [draftContext, setDraftContext] = useState<ExecutableContext | null>(null);
  const [previewDraft, setPreviewDraft] = useState(false);
  const [editError, setEditError] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "model"; text: string }[]>(
    [],
  );
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [chatError, setChatError] = useState("");
  /** stub / quota フォールバックなど、チャット自体は返ったが注意が必要なとき */
  const [chatStubNotice, setChatStubNotice] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [checkFilter, setCheckFilter] = useState<
    "all" | "action_required" | "info_only"
  >(
    "all",
  );
  const [collapseInfoChecks, setCollapseInfoChecks] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [criticalCursor, setCriticalCursor] = useState(0);
  const [manualCursor, setManualCursor] = useState(0);
  const [showPostSaveActions, setShowPostSaveActions] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const [showExportRiskConfirm, setShowExportRiskConfirm] = useState(false);
  const [showPendingTestDetails, setShowPendingTestDetails] = useState(false);
  const [showTestHelpers, setShowTestHelpers] = useState(false);
  const [pendingTestCheckStatus, setPendingTestCheckStatus] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(PENDING_TEST_CHECKS.map((item) => [item.id, false])) as Record<
      string,
      boolean
    >,
  );
  const [highlightSection, setHighlightSection] = useState<
    "priority" | "response" | "taboos" | "examples" | null
  >(null);
  const [highlightTone, setHighlightTone] = useState<CheckLevel | null>(null);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const priorityRef = useRef<HTMLDivElement | null>(null);
  const responseRef = useRef<HTMLDivElement | null>(null);
  const taboosRef = useRef<HTMLDivElement | null>(null);
  const examplesRef = useRef<HTMLDivElement | null>(null);
  const editModeCardRef = useRef<HTMLDivElement | null>(null);
  const exportCardRef = useRef<HTMLDivElement | null>(null);
  const testCardRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const exportPreviewRef = useRef<HTMLPreElement | null>(null);
  const showShortcutHelpRef = useRef(false);
  const recommendedTargetsRef = useRef<
    Array<{ target: ExportTarget; score: number; reason: string }>
  >([]);
  const activeTargetRef = useRef(activeTarget);

  const scrollToEditModeCardTop = () => {
    const node = editModeCardRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const scrollToExportCardTop = () => {
    exportCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const scrollToTestCardTop = () => {
    testCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const focusFirstInputInSection = (
    section: "priority" | "response" | "taboos" | "examples",
  ) => {
    const root =
      section === "priority"
        ? priorityRef.current
        : section === "response"
          ? responseRef.current
          : section === "taboos"
            ? taboosRef.current
            : examplesRef.current;
    if (!root) return;
    window.setTimeout(() => {
      const field = root.querySelector("input, textarea, select") as
        | HTMLElement
        | null;
      field?.focus();
    }, 80);
  };

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    const duration =
      message.length > 90 ? 3600 : message.length > 50 ? 2800 : 1800;
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, duration);
  }, []);

  useEffect(() => {
    setDraftContext(context ?? null);
  }, [context]);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RECOMMENDED_TARGET_STORAGE_KEY);
      if (!stored) return;
      if (ALL_TARGETS.includes(stored as ExportTarget)) {
        setActiveTarget(stored as ExportTarget);
      }
    } catch {
      // ignore storage read errors
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(RECOMMENDED_TARGET_STORAGE_KEY, activeTarget);
    } catch {
      // ignore storage write errors
    }
  }, [activeTarget]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TEST_REVALIDATION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setPendingTestCheckStatus((prev) => {
        const next = { ...prev };
        for (const item of PENDING_TEST_CHECKS) {
          next[item.id] = Boolean(parsed[item.id]);
        }
        return next;
      });
    } catch {
      // ignore storage read errors
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        TEST_REVALIDATION_STORAGE_KEY,
        JSON.stringify(pendingTestCheckStatus),
      );
    } catch {
      // ignore storage write errors
    }
  }, [pendingTestCheckStatus]);

  const activeMarkdown = useMemo(
    () => {
      const stored = exports?.[activeTarget];
      if (stored && stored.trim().length > 0) return stored;
      if (context) return renderForTarget(context, activeTarget).markdown;
      return "";
    },
    [exports, activeTarget, context],
  );
  const draftPreviewMarkdown = useMemo(() => {
    if (!draftContext) return "";
    return renderForTarget(draftContext, activeTarget).markdown;
  }, [draftContext, activeTarget]);
  const previewingUnsaved = editMode && previewDraft && Boolean(draftContext);
  const displayedMarkdown = previewingUnsaved ? draftPreviewMarkdown : activeMarkdown;
  const currentProfile = profiles.find((p) => p.id === currentProfileId);
  const recommendedTargets = useMemo(
    () => recommendTargetsFromTags(currentProfile?.tags ?? []),
    [currentProfile?.tags],
  );
  const lastUserChatMessage = useMemo(() => {
    for (let i = chat.length - 1; i >= 0; i--) {
      const m = chat[i];
      if (m.role === "user" && m.text.trim()) {
        return m.text.replace(/^比較入力:\s*/, "").trim();
      }
    }
    return "";
  }, [chat]);
  const compareMessage = draft.trim() || lastUserChatMessage;
  const comparePair = useMemo(() => {
    if (recommendedTargets.length >= 2) {
      return recommendedTargets.slice(0, 2);
    }
    const pair: Array<{ target: ExportTarget; score: number; reason: string }> =
      [];
    const pushTarget = (target: ExportTarget, reason: string) => {
      if (pair.some((p) => p.target === target)) return;
      const md =
        exports?.[target] ??
        (context ? renderForTarget(context, target).markdown : "");
      if (!md.trim()) return;
      pair.push({ target, score: 0, reason });
    };
    pushTarget(activeTarget, "現在選択中");
    for (const t of ALL_TARGETS) {
      if (pair.length >= 2) break;
      pushTarget(t, "代替比較候補");
    }
    return pair;
  }, [recommendedTargets, activeTarget, exports, context]);
  const topRecommendedTarget = recommendedTargets[0]?.target;
  const topRecommendedReason = recommendedTargets[0]?.reason;
  const topRecommendedScore = recommendedTargets[0]?.score ?? 0;
  const topIsStrongRecommendation = topRecommendedScore >= 60;
  const orderedTargetButtons = EXPORT_TAB_ORDER;
  const displayedRecommendations = showAllRecommendations
    ? recommendedTargets
    : recommendedTargets.slice(0, 3);
  const exportHeadings = useMemo(() => {
    const lines = displayedMarkdown.split("\n");
    const out: Array<{ text: string; label: string; line: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^##\s+(.+)$/);
      if (!m) continue;
      const text = m[1].trim();
      const label =
        text
          .replace(/^\d+\.\s*/, "")
          .replace(/[（(].+[）)]\s*$/, "")
          .trim() || text;
      out.push({ text, label, line: i });
    }
    return out;
  }, [displayedMarkdown]);

  const activeContext = editMode && draftContext ? draftContext : context;
  const quickTestPrompts = useMemo(() => {
    const fromExamples =
      activeContext?.examples
        .map((e) => e.scenario.trim())
        .filter((text) => text.length > 0) ?? [];
    const unique: string[] = [];
    for (const text of fromExamples) {
      if (unique.includes(text)) continue;
      unique.push(text);
      if (unique.length >= 3) break;
    }
    return unique;
  }, [activeContext?.examples]);
  const hasUnsavedEditChanges = useMemo(() => {
    if (!editMode || !draftContext || !context) return false;
    return JSON.stringify(draftContext) !== JSON.stringify(context);
  }, [editMode, draftContext, context]);
  const editDiffSummary = useMemo(() => {
    if (!editMode || !draftContext || !context) return [] as string[];

    const countIncompleteGates = (gates: PriorityGate[]): number =>
      gates.filter(
        (g) =>
          !g.when.trim() ||
          !g.choose.trim() ||
          !g.over.trim() ||
          !g.rationale.trim(),
      ).length;
    const countEmptyRules = (rules: Rule[]): number =>
      rules.filter((r) => !r.statement.trim()).length;
    const countIncompleteExamples = (examples: ExampleCase[]): number =>
      examples.filter(
        (e) => !e.scenario.trim() || !e.good.trim() || !e.bad.trim(),
      ).length;

    const parts: string[] = [];
    if (draftContext.priorityGates.length !== context.priorityGates.length) {
      const delta = draftContext.priorityGates.length - context.priorityGates.length;
      parts.push(`Priority件数 ${delta > 0 ? "+" : ""}${delta}`);
    }
    if (
      draftContext.responseProtocol.rules.length !==
      context.responseProtocol.rules.length
    ) {
      const delta =
        draftContext.responseProtocol.rules.length -
        context.responseProtocol.rules.length;
      parts.push(`Response件数 ${delta > 0 ? "+" : ""}${delta}`);
    }
    if (draftContext.taboos.length !== context.taboos.length) {
      const delta = draftContext.taboos.length - context.taboos.length;
      parts.push(`Taboos件数 ${delta > 0 ? "+" : ""}${delta}`);
    }
    if (draftContext.examples.length !== context.examples.length) {
      const delta = draftContext.examples.length - context.examples.length;
      parts.push(`Examples件数 ${delta > 0 ? "+" : ""}${delta}`);
    }

    const priorityIncompleteDelta =
      countIncompleteGates(draftContext.priorityGates) -
      countIncompleteGates(context.priorityGates);
    if (priorityIncompleteDelta !== 0) {
      parts.push(`Priority空欄 ${priorityIncompleteDelta > 0 ? "+" : ""}${priorityIncompleteDelta}`);
    }
    const responseEmptyDelta =
      countEmptyRules(draftContext.responseProtocol.rules) -
      countEmptyRules(context.responseProtocol.rules);
    if (responseEmptyDelta !== 0) {
      parts.push(`Response空欄 ${responseEmptyDelta > 0 ? "+" : ""}${responseEmptyDelta}`);
    }
    const taboosEmptyDelta =
      countEmptyRules(draftContext.taboos) - countEmptyRules(context.taboos);
    if (taboosEmptyDelta !== 0) {
      parts.push(`Taboos空欄 ${taboosEmptyDelta > 0 ? "+" : ""}${taboosEmptyDelta}`);
    }
    const examplesIncompleteDelta =
      countIncompleteExamples(draftContext.examples) -
      countIncompleteExamples(context.examples);
    if (examplesIncompleteDelta !== 0) {
      parts.push(
        `Examples空欄 ${examplesIncompleteDelta > 0 ? "+" : ""}${examplesIncompleteDelta}`,
      );
    }
    return parts;
  }, [editMode, draftContext, context]);
  const qualityChecks = useMemo(
    () => buildQualityChecks(activeContext),
    [activeContext],
  );
  const displayedQualityChecks = qualityChecks;
  const criticalCount = displayedQualityChecks.filter(
    (c) => c.level === "critical",
  ).length;
  const warningCount = displayedQualityChecks.filter(
    (c) => c.level === "warning",
  ).length;
  const infoCount = displayedQualityChecks.filter((c) => c.level === "info").length;
  const actionRequiredCount = criticalCount + warningCount;
  const filteredQualityChecks = useMemo(() => {
    if (checkFilter === "all") return displayedQualityChecks;
    if (checkFilter === "action_required") {
      return displayedQualityChecks.filter(
        (c) => c.level === "critical" || c.level === "warning",
      );
    }
    return displayedQualityChecks.filter((c) => c.level === "info");
  }, [displayedQualityChecks, checkFilter]);
  const visibleQualityChecks = useMemo(() => {
    if (!collapseInfoChecks) return filteredQualityChecks;
    return filteredQualityChecks.filter((c) => c.level !== "info");
  }, [filteredQualityChecks, collapseInfoChecks]);
  const prioritizedVisibleQualityChecks = useMemo(() => {
    const manualRank = (check: QualityCheck): number =>
      (check.level === "critical" || check.level === "warning") &&
      !AUTO_FIXABLE_CHECK_IDS.includes(
        check.id as (typeof AUTO_FIXABLE_CHECK_IDS)[number],
      )
        ? 0
        : 1;
    return [...visibleQualityChecks].sort((a, b) => {
      const rankDiff = manualRank(a) - manualRank(b);
      if (rankDiff !== 0) return rankDiff;
      return 0;
    });
  }, [visibleQualityChecks]);
  const criticalJumpTargets = useMemo(
    () =>
      displayedQualityChecks.filter(
        (c) =>
          (c.level === "critical" || c.level === "warning") && c.targetSection,
      ),
    [displayedQualityChecks],
  );
  const autoFixableActionRequiredCount = useMemo(
    () =>
      displayedQualityChecks.filter(
        (c) =>
          (c.level === "critical" || c.level === "warning") &&
          AUTO_FIXABLE_CHECK_IDS.includes(c.id as (typeof AUTO_FIXABLE_CHECK_IDS)[number]),
      ).length,
    [displayedQualityChecks],
  );
  const manualActionRequiredCount = useMemo(
    () =>
      displayedQualityChecks.filter(
        (c) =>
          (c.level === "critical" || c.level === "warning") &&
          !AUTO_FIXABLE_CHECK_IDS.includes(
            c.id as (typeof AUTO_FIXABLE_CHECK_IDS)[number],
          ),
      ).length,
    [displayedQualityChecks],
  );
  const unresolvedManualChecks = useMemo(
    () =>
      displayedQualityChecks.filter(
        (c) =>
          (c.level === "critical" || c.level === "warning") &&
          !AUTO_FIXABLE_CHECK_IDS.includes(
            c.id as (typeof AUTO_FIXABLE_CHECK_IDS)[number],
          ),
      ),
    [displayedQualityChecks],
  );
  const isPublishReady =
    actionRequiredCount === 0 && !editMode && !hasUnsavedEditChanges;
  const exportStatusLabel =
    actionRequiredCount > 0
      ? "要修正あり"
      : hasUnsavedEditChanges
        ? "未保存あり"
        : "公開準備OK";
  const manualJumpTargets = useMemo(
    () =>
      displayedQualityChecks.filter(
        (c) =>
          (c.level === "critical" || c.level === "warning") &&
          !AUTO_FIXABLE_CHECK_IDS.includes(
            c.id as (typeof AUTO_FIXABLE_CHECK_IDS)[number],
          ) &&
          Boolean(c.targetSection),
      ),
    [displayedQualityChecks],
  );

  const updateGate = (
    index: number,
    key: keyof PriorityGate,
    value: string | Intensity,
  ) => {
    if (!draftContext) return;
    const next = [...draftContext.priorityGates];
    next[index] = { ...next[index], [key]: value } as PriorityGate;
    setDraftContext({ ...draftContext, priorityGates: next });
  };

  const addGate = () => {
    if (!draftContext) return;
    const newIndex = draftContext.priorityGates.length;
    const gate: PriorityGate = {
      id: `pg_manual_${Date.now()}`,
      when: "AとBで迷ったら",
      choose: "A",
      over: "B",
      rationale: "手動追加",
      intensity: "SHOULD",
    };
    setDraftContext({
      ...draftContext,
      priorityGates: [...draftContext.priorityGates, gate],
    });
    jumpToNewlyAddedCard("priority", newIndex);
  };

  const removeGate = (index: number) => {
    if (!draftContext) return;
    const next = draftContext.priorityGates.filter((_, i) => i !== index);
    setDraftContext({ ...draftContext, priorityGates: next });
  };

  const updateRule = (
    section: "responseProtocol" | "taboos",
    index: number,
    key: keyof Rule,
    value: string | Intensity,
  ) => {
    if (!draftContext) return;
    if (section === "responseProtocol") {
      const next = [...draftContext.responseProtocol.rules];
      next[index] = { ...next[index], [key]: value } as Rule;
      setDraftContext({
        ...draftContext,
        responseProtocol: { ...draftContext.responseProtocol, rules: next },
      });
      return;
    }
    const next = [...draftContext.taboos];
    next[index] = { ...next[index], [key]: value } as Rule;
    setDraftContext({ ...draftContext, taboos: next });
  };

  const addRule = (section: "responseProtocol" | "taboos") => {
    if (!draftContext) return;
    const rule: Rule = {
      intensity: "SHOULD",
      statement: "新しいルールを記述する",
      source: "inferred",
    };
    if (section === "responseProtocol") {
      const newIndex = draftContext.responseProtocol.rules.length;
      setDraftContext({
        ...draftContext,
        responseProtocol: {
          ...draftContext.responseProtocol,
          rules: [...draftContext.responseProtocol.rules, rule],
        },
      });
      jumpToNewlyAddedCard("response", newIndex);
      return;
    }
    const newIndex = draftContext.taboos.length;
    setDraftContext({ ...draftContext, taboos: [...draftContext.taboos, rule] });
    jumpToNewlyAddedCard("taboos", newIndex);
  };

  const removeRule = (section: "responseProtocol" | "taboos", index: number) => {
    if (!draftContext) return;
    if (section === "responseProtocol") {
      const next = draftContext.responseProtocol.rules.filter((_, i) => i !== index);
      setDraftContext({
        ...draftContext,
        responseProtocol: { ...draftContext.responseProtocol, rules: next },
      });
      return;
    }
    const next = draftContext.taboos.filter((_, i) => i !== index);
    setDraftContext({ ...draftContext, taboos: next });
  };

  const updateExample = (
    index: number,
    key: keyof ExampleCase,
    value: string,
  ) => {
    if (!draftContext) return;
    const next = [...draftContext.examples];
    next[index] = { ...next[index], [key]: value };
    setDraftContext({ ...draftContext, examples: next });
  };

  const addExample = () => {
    if (!draftContext) return;
    const newIndex = draftContext.examples.length;
    setDraftContext({
      ...draftContext,
      examples: [
        ...draftContext.examples,
        { scenario: "", good: "", bad: "" },
      ],
    });
    jumpToNewlyAddedCard("examples", newIndex);
  };

  const removeExample = (index: number) => {
    if (!draftContext) return;
    setDraftContext({
      ...draftContext,
      examples: draftContext.examples.filter((_, i) => i !== index),
    });
  };

  const fillExamplePlaceholders = () => {
    if (!draftContext) return;
    const firstIncompleteIndex = findFirstIncompleteExampleIndex(draftContext.examples);
    const scenarioHints = [
      "例: 料金の見直しを相談されたとき",
      "例: 納期と品質が両立しにくいと言われたとき",
      "例: 競合比較を求められたとき",
    ];
    const goodHints = [
      "例: 前提を1行で確認し、トレードオフを表で示す",
      "例: まず守るべき指標を確認してから代替案を2つ出す",
      "例: 比較軸を固定し、差分だけを箇条書きにする",
    ];
    const badHints = [
      "例: 一般論だけで締めて具体策がない",
      "例: どちらも重要と逃げて優先順位を決めない",
      "例: 銘柄名だけ並べて選び方が不明",
    ];
    const next = draftContext.examples.map((ex, i) => ({
      scenario:
        ex.scenario.trim() ||
        scenarioHints[i % scenarioHints.length],
      good: ex.good.trim() || goodHints[i % goodHints.length],
      bad: ex.bad.trim() || badHints[i % badHints.length],
    }));
    setDraftContext({ ...draftContext, examples: next });
    showToast("Examples の空欄に例文を補完しました。");
    if (firstIncompleteIndex >= 0) {
      jumpToSection("examples", "info", firstIncompleteIndex);
      return;
    }
    focusFirstInputInSection("examples");
  };

  const canFillExamplePlaceholders = Boolean(
    draftContext?.examples.some(
      (e) => !e.scenario.trim() || !e.good.trim() || !e.bad.trim(),
    ),
  );

  const fillPriorityExamples = () => {
    if (!draftContext) return;
    const firstIncompleteIndex = findFirstIncompleteGateIndex(draftContext.priorityGates);
    const next = draftContext.priorityGates.map((g, i) => ({
      ...g,
      when:
        g.when.trim() ||
        PRIORITY_WHEN_PLACEHOLDERS[i % PRIORITY_WHEN_PLACEHOLDERS.length],
      choose:
        g.choose.trim() ||
        PRIORITY_CHOOSE_PLACEHOLDERS[i % PRIORITY_CHOOSE_PLACEHOLDERS.length],
      over:
        g.over.trim() ||
        PRIORITY_OVER_PLACEHOLDERS[i % PRIORITY_OVER_PLACEHOLDERS.length],
      rationale:
        g.rationale.trim() ||
        PRIORITY_RATIONALE_PLACEHOLDERS[
          i % PRIORITY_RATIONALE_PLACEHOLDERS.length
        ],
    }));
    setDraftContext({ ...draftContext, priorityGates: next });
    showToast("Priority Gate の空欄に入力例を補完しました。");
    if (firstIncompleteIndex >= 0) {
      jumpToSection("priority", "info", firstIncompleteIndex);
      return;
    }
    focusFirstInputInSection("priority");
  };

  const fillRuleExamples = (section: "responseProtocol" | "taboos") => {
    if (!draftContext) return;
    if (section === "responseProtocol") {
      const firstIncompleteIndex = findFirstEmptyRuleIndex(draftContext.responseProtocol.rules);
      const next = draftContext.responseProtocol.rules.map((r, i) => ({
        ...r,
        statement:
          r.statement.trim() ||
          RESPONSE_RULE_PLACEHOLDERS[i % RESPONSE_RULE_PLACEHOLDERS.length],
      }));
      setDraftContext({
        ...draftContext,
        responseProtocol: { ...draftContext.responseProtocol, rules: next },
      });
      showToast("Response Protocol の空欄に入力例を補完しました。");
      if (firstIncompleteIndex >= 0) {
        jumpToSection("response", "info", firstIncompleteIndex);
        return;
      }
      focusFirstInputInSection("response");
      return;
    }
    const firstIncompleteIndex = findFirstEmptyRuleIndex(draftContext.taboos);
    const next = draftContext.taboos.map((r, i) => ({
      ...r,
      statement:
        r.statement.trim() || TABOO_RULE_PLACEHOLDERS[i % TABOO_RULE_PLACEHOLDERS.length],
    }));
    setDraftContext({ ...draftContext, taboos: next });
    showToast("Taboos の空欄に入力例を補完しました。");
    if (firstIncompleteIndex >= 0) {
      jumpToSection("taboos", "info", firstIncompleteIndex);
      return;
    }
    focusFirstInputInSection("taboos");
  };

  const canFillPriorityExamples = Boolean(
    draftContext?.priorityGates.some(
      (g) =>
        !g.when.trim() ||
        !g.choose.trim() ||
        !g.over.trim() ||
        !g.rationale.trim(),
    ),
  );
  const canFillResponseExamples = Boolean(
    draftContext?.responseProtocol.rules.some((r) => !r.statement.trim()),
  );
  const canFillTabooExamples = Boolean(
    draftContext?.taboos.some((r) => !r.statement.trim()),
  );

  const applyBulkActionRequiredFixes = () => {
    const source = draftContext ?? context;
    if (!source) return;
    const fixedCounts = {
      priorityAdded: 0,
      priorityFilled: 0,
      responseFilled: 0,
      taboosFilled: 0,
      examplesAdded: 0,
      examplesFilled: 0,
    };

    const next: ExecutableContext = {
      ...source,
      priorityGates: source.priorityGates.map((g) => ({ ...g })),
      responseProtocol: {
        ...source.responseProtocol,
        rules: source.responseProtocol.rules.map((r) => ({ ...r })),
      },
      taboos: source.taboos.map((t) => ({ ...t })),
      examples: source.examples.map((e) => ({ ...e })),
    };

    // Priority Gate が足りないときは、最低3件まで補完する
    while (next.priorityGates.length < 3) {
      const i = next.priorityGates.length;
      next.priorityGates.push({
        id: `pg_bulk_${Date.now()}_${i.toString()}`,
        when: PRIORITY_WHEN_PLACEHOLDERS[i % PRIORITY_WHEN_PLACEHOLDERS.length],
        choose: PRIORITY_CHOOSE_PLACEHOLDERS[i % PRIORITY_CHOOSE_PLACEHOLDERS.length],
        over: PRIORITY_OVER_PLACEHOLDERS[i % PRIORITY_OVER_PLACEHOLDERS.length],
        rationale:
          PRIORITY_RATIONALE_PLACEHOLDERS[
            i % PRIORITY_RATIONALE_PLACEHOLDERS.length
          ],
        intensity: "SHOULD",
      });
      fixedCounts.priorityAdded += 1;
    }
    next.priorityGates = next.priorityGates.map((g, i) => ({
      ...g,
      when: g.when.trim() || PRIORITY_WHEN_PLACEHOLDERS[i % PRIORITY_WHEN_PLACEHOLDERS.length],
      choose:
        g.choose.trim() ||
        PRIORITY_CHOOSE_PLACEHOLDERS[i % PRIORITY_CHOOSE_PLACEHOLDERS.length],
      over: g.over.trim() || PRIORITY_OVER_PLACEHOLDERS[i % PRIORITY_OVER_PLACEHOLDERS.length],
      rationale:
        g.rationale.trim() ||
        PRIORITY_RATIONALE_PLACEHOLDERS[i % PRIORITY_RATIONALE_PLACEHOLDERS.length],
    }));
    source.priorityGates.forEach((g) => {
      if (!g.when.trim() || !g.choose.trim() || !g.over.trim() || !g.rationale.trim()) {
        fixedCounts.priorityFilled += 1;
      }
    });

    next.responseProtocol.rules = next.responseProtocol.rules.map((r, i) => {
      if (!r.statement.trim()) fixedCounts.responseFilled += 1;
      return {
        ...r,
        statement:
          r.statement.trim() ||
          RESPONSE_RULE_PLACEHOLDERS[i % RESPONSE_RULE_PLACEHOLDERS.length],
      };
    });
    next.taboos = next.taboos.map((r, i) => {
      if (!r.statement.trim()) fixedCounts.taboosFilled += 1;
      return {
        ...r,
        statement:
          r.statement.trim() || TABOO_RULE_PLACEHOLDERS[i % TABOO_RULE_PLACEHOLDERS.length],
      };
    });

    if (next.examples.length === 0) {
      next.examples.push({
        scenario: "例: 料金の見直しを相談されたとき",
        good: "例: 前提を1行で確認し、トレードオフを表で示す",
        bad: "例: 一般論だけで締めて具体策がない",
      });
      fixedCounts.examplesAdded += 1;
    }
    next.examples = next.examples.map((ex, i) => {
      if (!ex.scenario.trim() || !ex.good.trim() || !ex.bad.trim()) {
        fixedCounts.examplesFilled += 1;
      }
      return {
        scenario: ex.scenario.trim() || `例: ケース ${i + 1} の相談場面`,
        good: ex.good.trim() || "例: 先に結論を示し、理由と次の一手を短く提示する",
        bad: ex.bad.trim() || "例: 抽象的な一般論だけで終える",
      };
    });

    const before = buildQualityChecks(source).filter(
      (c) => c.level === "critical" || c.level === "warning",
    ).length;
    const postChecks = buildQualityChecks(next);
    const after = postChecks.filter(
      (c) => c.level === "critical" || c.level === "warning",
    ).length;
    const nextManualCheck = postChecks.find(
      (c) =>
        (c.level === "critical" || c.level === "warning") && !canAutoFixCheck(c),
    );

    setDraftContext(next);
    setEditMode(true);
    setPreviewDraft(true);
    setEditError("");

    if (before === after) {
      showToast(
        "自動補完できる要修正はありませんでした。重複・抽象表現は手動で調整してください。",
      );
    } else {
      const details: string[] = [];
      if (fixedCounts.priorityAdded > 0) {
        details.push(`Priority追加 ${fixedCounts.priorityAdded.toString()}件`);
      }
      if (fixedCounts.priorityFilled > 0) {
        details.push(`Priority補完 ${fixedCounts.priorityFilled.toString()}件`);
      }
      if (fixedCounts.responseFilled > 0) {
        details.push(`Response補完 ${fixedCounts.responseFilled.toString()}件`);
      }
      if (fixedCounts.taboosFilled > 0) {
        details.push(`Taboos補完 ${fixedCounts.taboosFilled.toString()}件`);
      }
      if (fixedCounts.examplesAdded > 0) {
        details.push(`Examples追加 ${fixedCounts.examplesAdded.toString()}件`);
      }
      if (fixedCounts.examplesFilled > 0) {
        details.push(`Examples補完 ${fixedCounts.examplesFilled.toString()}件`);
      }
      const detailText = details.length > 0 ? ` / ${details.join(" / ")}` : "";
      showToast(
        `要修正を一括補完しました（${before.toString()}件 → ${after.toString()}件）${detailText}`,
      );
    }
    window.setTimeout(() => {
      if (nextManualCheck?.targetSection) {
        jumpToSection(
          nextManualCheck.targetSection,
          nextManualCheck.level,
          nextManualCheck.targetIndex,
        );
        showToast("自動補完後、手動対応が必要な項目へ移動しました。");
        return;
      }
      jumpToNextCritical();
    }, 0);
  };

  const canAutoFixCheck = (check: QualityCheck): boolean =>
    AUTO_FIXABLE_CHECK_IDS.includes(
      check.id as (typeof AUTO_FIXABLE_CHECK_IDS)[number],
    );

  const applySingleCheckFix = (check: QualityCheck) => {
    const source = draftContext ?? context;
    if (!source) return;
    if (!canAutoFixCheck(check)) {
      showToast("この項目は自動補完の対象外です。手動で調整してください。");
      return;
    }
    const next: ExecutableContext = {
      ...source,
      priorityGates: source.priorityGates.map((g) => ({ ...g })),
      responseProtocol: {
        ...source.responseProtocol,
        rules: source.responseProtocol.rules.map((r) => ({ ...r })),
      },
      taboos: source.taboos.map((t) => ({ ...t })),
      examples: source.examples.map((e) => ({ ...e })),
    };

    if (check.id === "must-empty") {
      if (check.targetSection === "response" && typeof check.targetIndex === "number") {
        next.responseProtocol.rules = next.responseProtocol.rules.map((r, i) => ({
          ...r,
          statement:
            i === check.targetIndex && r.intensity === "MUST" && !r.statement.trim()
              ? RESPONSE_RULE_PLACEHOLDERS[i % RESPONSE_RULE_PLACEHOLDERS.length]
              : r.statement,
        }));
      } else if (
        check.targetSection === "taboos" &&
        typeof check.targetIndex === "number"
      ) {
        next.taboos = next.taboos.map((r, i) => ({
          ...r,
          statement:
            i === check.targetIndex && r.intensity === "MUST" && !r.statement.trim()
              ? TABOO_RULE_PLACEHOLDERS[i % TABOO_RULE_PLACEHOLDERS.length]
              : r.statement,
        }));
      } else {
        next.responseProtocol.rules = next.responseProtocol.rules.map((r, i) => ({
          ...r,
          statement:
            r.intensity === "MUST" && !r.statement.trim()
              ? RESPONSE_RULE_PLACEHOLDERS[i % RESPONSE_RULE_PLACEHOLDERS.length]
              : r.statement,
        }));
        next.taboos = next.taboos.map((r, i) => ({
          ...r,
          statement:
            r.intensity === "MUST" && !r.statement.trim()
              ? TABOO_RULE_PLACEHOLDERS[i % TABOO_RULE_PLACEHOLDERS.length]
              : r.statement,
        }));
      }
    } else if (check.id === "priority-gates-count") {
      while (next.priorityGates.length < 3) {
        const i = next.priorityGates.length;
        next.priorityGates.push({
          id: `pg_single_${Date.now()}_${i.toString()}`,
          when: PRIORITY_WHEN_PLACEHOLDERS[i % PRIORITY_WHEN_PLACEHOLDERS.length],
          choose: PRIORITY_CHOOSE_PLACEHOLDERS[i % PRIORITY_CHOOSE_PLACEHOLDERS.length],
          over: PRIORITY_OVER_PLACEHOLDERS[i % PRIORITY_OVER_PLACEHOLDERS.length],
          rationale:
            PRIORITY_RATIONALE_PLACEHOLDERS[
              i % PRIORITY_RATIONALE_PLACEHOLDERS.length
            ],
          intensity: "SHOULD",
        });
      }
    } else if (check.id === "priority-gate-fields") {
      next.priorityGates = next.priorityGates.map((g, i) => {
        if (typeof check.targetIndex === "number" && i !== check.targetIndex) {
          return g;
        }
        return {
          ...g,
          when:
            g.when.trim() ||
            PRIORITY_WHEN_PLACEHOLDERS[i % PRIORITY_WHEN_PLACEHOLDERS.length],
          choose:
            g.choose.trim() ||
            PRIORITY_CHOOSE_PLACEHOLDERS[i % PRIORITY_CHOOSE_PLACEHOLDERS.length],
          over:
            g.over.trim() ||
            PRIORITY_OVER_PLACEHOLDERS[i % PRIORITY_OVER_PLACEHOLDERS.length],
          rationale:
            g.rationale.trim() ||
            PRIORITY_RATIONALE_PLACEHOLDERS[i % PRIORITY_RATIONALE_PLACEHOLDERS.length],
        };
      });
    } else if (check.id === "examples-count") {
      if (next.examples.length < 1) {
        next.examples.push({
          scenario: "例: 料金の見直しを相談されたとき",
          good: "例: 前提を1行で確認し、トレードオフを表で示す",
          bad: "例: 一般論だけで締めて具体策がない",
        });
      }
    } else if (check.id === "examples-incomplete") {
      next.examples = next.examples.map((ex, i) => {
        if (typeof check.targetIndex === "number" && i !== check.targetIndex) {
          return ex;
        }
        return {
          scenario: ex.scenario.trim() || `例: ケース ${i + 1} の相談場面`,
          good: ex.good.trim() || "例: 先に結論を示し、理由と次の一手を短く提示する",
          bad: ex.bad.trim() || "例: 抽象的な一般論だけで終える",
        };
      });
    }

    const before = buildQualityChecks(source).find((c) => c.id === check.id)?.level;
    const after = buildQualityChecks(next).find((c) => c.id === check.id)?.level;
    const targetLabel =
      check.targetSection === "priority" && typeof check.targetIndex === "number"
        ? `Gate ${(check.targetIndex + 1).toString()}`
        : check.targetSection === "response" && typeof check.targetIndex === "number"
          ? `Rule ${(check.targetIndex + 1).toString()}`
          : check.targetSection === "taboos" && typeof check.targetIndex === "number"
            ? `Taboo ${(check.targetIndex + 1).toString()}`
            : check.targetSection === "examples" && typeof check.targetIndex === "number"
              ? `Example ${(check.targetIndex + 1).toString()}`
              : "該当項目";

    setDraftContext(next);
    setEditMode(true);
    setPreviewDraft(true);
    setEditError("");

    if (before !== after && (after === "info" || after === undefined)) {
      showToast(`${targetLabel} を補完しました。`);
    } else {
      showToast(`${targetLabel} の補完を試しました。必要なら手動で微調整してください。`);
    }

    window.setTimeout(() => {
      jumpToSection(check.targetSection, check.level, check.targetIndex);
    }, 0);
  };
  const recheckSingleItem = (check: QualityCheck) => {
    const source = draftContext ?? context;
    if (!source) return;
    const latest = buildQualityChecks(source).find((c) => c.id === check.id);
    if (!latest) {
      showToast("この項目は現在のチェック一覧にありません。");
      return;
    }
    if (latest.level === "info") {
      showToast("この項目は解消済みです。");
      return;
    }
    showToast("まだ要修正です。テンプレを参考に手動で微調整してください。");
  };

  const saveEdits = () => {
    if (!draftContext) return;
    if (!hasUnsavedEditChanges) {
      showToast("未保存の変更はありません。");
      return;
    }
    if (draftContext.priorityGates.length < 1) {
      setEditError("Priority Gate は最低1件必要です。");
      jumpToSection("priority", "critical");
      return;
    }
    const emptyMustResponseIndex = draftContext.responseProtocol.rules.findIndex(
      (r) => r.intensity === "MUST" && !r.statement.trim(),
    );
    if (emptyMustResponseIndex >= 0) {
      setEditError("Response Protocol の MUST ルールに空の文があります。");
      jumpToSection("response", "critical", emptyMustResponseIndex);
      return;
    }
    const emptyMustTabooIndex = draftContext.taboos.findIndex(
      (r) => r.intensity === "MUST" && !r.statement.trim(),
    );
    if (emptyMustTabooIndex >= 0) {
      setEditError("Taboos の MUST ルールに空の文があります。");
      jumpToSection("taboos", "critical", emptyMustTabooIndex);
      return;
    }

    setEditError("");
    setContext(draftContext);
    const rendered = renderAllTargets(draftContext);
    const out: Record<string, string> = {};
    for (const [target, payload] of Object.entries(rendered)) {
      out[target] = payload.markdown;
    }
    setExports(out);
    setEditMode(false);
    setShowPostSaveActions(true);
    setShowSaveConfirm(false);
    showToast("変更を保存して反映しました。");
  };
  const requestSaveEdits = () => {
    if (!draftContext) return;
    if (!hasUnsavedEditChanges) {
      showToast("未保存の変更はありません。");
      return;
    }
    setShowSaveConfirm(true);
  };
  const requestSaveEditsRef = useRef(requestSaveEdits);
  requestSaveEditsRef.current = requestSaveEdits;
  const copyManualTemplate = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("修正テンプレをコピーしました。");
    } catch {
      showToast("コピーに失敗しました。");
    }
  };

  useEffect(() => {
    if (!editMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        requestSaveEditsRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        requestSaveEditsRef.current();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (!hasUnsavedEditChanges) {
          setDraftContext(context ?? null);
          setEditError("");
          setPreviewDraft(false);
          setShowSaveConfirm(false);
          setEditMode(false);
          showToast("編集モードを終了しました。");
          return;
        }
        const ok = window.confirm(
          "編集中の変更を破棄して戻りますか？（未保存の変更は失われます）",
        );
        if (!ok) return;
        setDraftContext(context ?? null);
        setEditError("");
        setPreviewDraft(false);
        setShowSaveConfirm(false);
        setEditMode(false);
        showToast("変更を破棄しました。");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editMode, context, hasUnsavedEditChanges, showToast]);

  useEffect(() => {
    if (!hasUnsavedEditChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedEditChanges]);

  useEffect(() => {
    if (!editMode) return;
    if (!editError) return;
    setEditError("");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- editError を依存に含めると、セット直後に消えてしまう
  }, [draftContext, editMode]);

  useEffect(() => {
    if (hasUnsavedEditChanges) {
      setShowPostSaveActions(false);
    }
  }, [hasUnsavedEditChanges]);

  useEffect(() => {
    if (!editMode) return;
    const timer = window.setTimeout(() => {
      const root = priorityRef.current;
      if (!root) return;
      const firstField = root.querySelector(
        "input, textarea, select",
      ) as HTMLElement | null;
      firstField?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [editMode, draftContext?.priorityGates.length]);

  const jumpToNewlyAddedCard = (
    section: "priority" | "response" | "taboos" | "examples",
    index: number,
  ) => {
    // 状態反映後に追加されたカードへ移動する
    window.setTimeout(() => {
      jumpToSection(section, "info", index);
    }, 80);
  };

  const jumpToSection = (
    section?: "priority" | "response" | "taboos" | "examples",
    level?: CheckLevel,
    targetIndex?: number,
  ) => {
    if (!section) return;
    if (!editMode) {
      setEditMode(true);
    }

    window.setTimeout(() => {
      const tryScrollToTarget = (attempt: number) => {
        const node =
          section === "priority"
            ? priorityRef.current
            : section === "response"
              ? responseRef.current
              : section === "taboos"
                ? taboosRef.current
                : examplesRef.current;

        if (!node) {
          if (attempt < 12) {
            window.setTimeout(() => tryScrollToTarget(attempt + 1), 70);
          }
          return;
        }

        const targetNode =
          typeof targetIndex === "number"
            ? (node.querySelector(
                `[data-editor-section="${section}"][data-editor-index="${targetIndex}"]`,
              ) as HTMLElement | null)
            : null;

        if (typeof targetIndex === "number" && !targetNode) {
          if (attempt < 12) {
            window.setTimeout(() => tryScrollToTarget(attempt + 1), 70);
          }
          return;
        }

        (targetNode ?? node).scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        window.setTimeout(() => {
          const focusRoot = targetNode ?? node;
          const focusField = focusRoot.querySelector("input, textarea, select") as
            | HTMLElement
            | null;
          focusField?.focus();
        }, 120);
        setHighlightSection(section);
        setHighlightTone(level ?? "info");
        setHighlightIndex(typeof targetIndex === "number" ? targetIndex : null);
        window.setTimeout(() => {
          setHighlightSection(null);
          setHighlightTone(null);
          setHighlightIndex(null);
        }, 2500);
      };

      tryScrollToTarget(0);
    }, 40);
  };

  const onCopy = async () => {
    if (!displayedMarkdown) return;
    try {
      await navigator.clipboard.writeText(displayedMarkdown);
      showToast("クリップボードへコピーしました。");
    } catch {
      setChatError(
        "コピーに失敗しました。ブラウザ権限をご確認のうえ、再度お試しください。",
      );
    }
  };

  const doDownload = () => {
    if (!displayedMarkdown) return;
    const blob = new Blob([displayedMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = previewingUnsaved
      ? TARGET_FILENAME[activeTarget].replace(".md", ".draft.md")
      : TARGET_FILENAME[activeTarget];
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(".md ファイルをダウンロードしました。");
  };
  const onDownload = () => {
    if (actionRequiredCount > 0) {
      setShowExportRiskConfirm(true);
      return;
    }
    doDownload();
  };
  const onCopyFilename = async () => {
    const filename = previewingUnsaved
      ? TARGET_FILENAME[activeTarget].replace(".md", ".draft.md")
      : TARGET_FILENAME[activeTarget];
    try {
      await navigator.clipboard.writeText(filename);
      showToast("ファイル名をコピーしました。");
    } catch {
      showToast("ファイル名のコピーに失敗しました。");
    }
  };
  const compareTopTwoRecommendations = async () => {
    const message = compareMessage;
    if (comparePair.length < 2 || !message || running) return;
    const pair = comparePair;
    setRunning(true);
    setChatError("");
    setChatStubNotice("");
    setDraft("");
    const nextHistory = [...chat, { role: "user" as const, text: `比較入力: ${message}` }];
    try {
      const replies: string[] = [];
      let notice = "";
      for (const item of pair) {
        const systemPromptRaw =
          editMode && draftContext
            ? renderForTarget(draftContext, item.target).markdown
            : exports?.[item.target] ?? "";
        const systemPrompt =
          systemPromptRaw && systemPromptRaw.trim().length > 0
            ? systemPromptRaw
            : context
              ? renderForTarget(context, item.target).markdown
              : "";
        if (!systemPrompt.trim()) {
          throw new Error(
            `${TARGET_LABEL[item.target]} のプロンプトが空です。先に生成または復元を確認してください。`,
          );
        }
        const res = await fetch("/api/test-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemPrompt,
            history: [],
            message,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          reply?: string;
          mode?: string;
          warning?: string;
          error?: string;
        };
        if (!res.ok) {
          const raw =
            typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
          throw new Error(formatHttpError(res.status, raw));
        }
        if (typeof data.reply !== "string") {
          throw new Error("比較応答の形式が不正です。");
        }
        replies.push(`[${TARGET_LABEL[item.target]}]\n${data.reply}`);
        if (data.mode === "stub_due_to_quota" && typeof data.warning === "string") {
          notice = data.warning;
        } else if (data.mode === "stub") {
          notice =
            "AIキー（環境変数: GEMINI_API_KEY）が未設定のためダミー応答です。.env.local にキーを設定すると実際の応答が返ります。";
        }
      }
      setChat([
        ...nextHistory,
        { role: "model", text: replies[0] ?? "" },
        { role: "model", text: replies[1] ?? "" },
      ]);
      if (notice) {
        setChatStubNotice(notice);
        if (notice.includes("stub_due_to_quota") || notice.includes("429")) {
          markPendingTestCheck("3-6");
        }
      }
      showToast("おすすめ1位と2位を連続比較しました。");
    } catch (err) {
      setChatError(formatClientFetchError(err));
    } finally {
      setRunning(false);
    }
  };
  const hasComparisonEntries = chat.some(
    (m) =>
      (m.role === "user" && m.text.startsWith("比較入力: ")) ||
      (m.role === "model" && /^\[[^\]]+\]\n/.test(m.text)),
  );
  const comparisonMarkdown = useMemo(() => {
    const lines: string[] = [];
    for (const m of chat) {
      if (m.role === "user" && m.text.startsWith("比較入力: ")) {
        lines.push(`## ${m.text}`);
      } else if (m.role === "model" && /^\[[^\]]+\]\n/.test(m.text)) {
        const [header, ...body] = m.text.split("\n");
        lines.push(`### ${header.replace(/^\[|\]$/g, "")}`);
        lines.push(body.join("\n"));
      }
    }
    return lines.join("\n\n").trim();
  }, [chat]);
  const downloadComparisonMarkdown = () => {
    if (!comparisonMarkdown) return;
    const blob = new Blob([comparisonMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `comparison-${stamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    markPendingTestCheck("3-5");
    showToast("比較結果を .md で保存しました。");
  };
  const clearComparisonResults = () => {
    const next = chat.filter(
      (m) =>
        !(
          (m.role === "user" && m.text.startsWith("比較入力: ")) ||
          (m.role === "model" && /^\[[^\]]+\]\n/.test(m.text))
        ),
    );
    setChat(next);
    setChatError("");
    setChatStubNotice("");
    markPendingTestCheck("3-4");
    showToast("比較結果のみクリアしました。");
  };
  const scrollPreviewToHeading = (line: number) => {
    const pre = exportPreviewRef.current;
    if (!pre) return;
    const lineHeight = 20;
    pre.scrollTo({ top: Math.max(0, line * lineHeight - lineHeight), behavior: "smooth" });
  };

  const onSendChat = async () => {
    if (!displayedMarkdown || !draft.trim() || running) return;
    setRunning(true);
    setChatError("");
    setChatStubNotice("");
    const userMsg = { role: "user" as const, text: draft.trim() };
    const nextHistory = [...chat, userMsg];
    setChat(nextHistory);
    setDraft("");
    try {
      const res = await fetch("/api/test-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: displayedMarkdown,
          history: chat,
          message: userMsg.text,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        mode?: string;
        warning?: string;
        error?: string;
      };
      if (!res.ok) {
        const raw =
          typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
        throw new Error(formatHttpError(res.status, raw));
      }
      if (typeof data.reply !== "string") {
        throw new Error(
          "応答の形式が不正です。しばらくしてから再試行してください。",
        );
      }
      setChat([...nextHistory, { role: "model", text: data.reply }]);
      if (
        data.mode === "stub_due_to_quota" &&
        typeof data.warning === "string"
      ) {
        setChatStubNotice(data.warning);
        markPendingTestCheck("3-6");
      } else if (data.mode === "stub") {
        setChatStubNotice(
          "AIキー（環境変数: GEMINI_API_KEY）が未設定のためダミー応答です。.env.local にキーを設定すると実際の応答が返ります。",
        );
      }
    } catch (err) {
      setChatError(formatClientFetchError(err));
    } finally {
      setRunning(false);
    }
  };

  const clearChatHistory = () => {
    setChat([]);
    setChatError("");
    setChatStubNotice("");
    showToast("テスト実行の履歴をクリアしました。");
  };

  const focusChatInput = () => {
    chatInputRef.current?.focus();
  };
  const verifiedPendingChecksCount = PENDING_TEST_CHECKS.filter(
    (item) => pendingTestCheckStatus[item.id],
  ).length;
  const pendingChecksRemaining =
    PENDING_TEST_CHECKS.length - verifiedPendingChecksCount;
  const pendingRemainingLabels = PENDING_TEST_CHECKS.filter(
    (item) => !pendingTestCheckStatus[item.id],
  )
    .map((item) => item.id)
    .join(" / ");
  const comparisonEntryCount = chat.filter(
    (m) => m.role === "model" && /^\[[^\]]+\]\n/.test(m.text),
  ).length;
  const compareDisabledReason =
    running
      ? "送信中です"
      : !compareMessage
        ? "テスト入力に質問を入れるか、先に送信して履歴を作ってください"
        : comparePair.length < 2
          ? "比較できるエクスポート形式が2件未満です（生成・復元を確認）"
          : "";
  const togglePendingTestCheck = (id: string) => {
    setPendingTestCheckStatus((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const markPendingTestCheck = (id: string) => {
    setPendingTestCheckStatus((prev) => ({ ...prev, [id]: true }));
  };
  const resetPendingTestChecks = () => {
    setPendingTestCheckStatus(
      Object.fromEntries(PENDING_TEST_CHECKS.map((item) => [item.id, false])) as Record<
        string,
        boolean
      >,
    );
    showToast("保留3項目を未検証に戻しました。");
  };
  const completePendingTestChecks = () => {
    setPendingTestCheckStatus(
      Object.fromEntries(PENDING_TEST_CHECKS.map((item) => [item.id, true])) as Record<
        string,
        boolean
      >,
    );
    showToast("保留3項目を検証済みにしました。");
  };

  const jumpToNextCritical = () => {
    if (criticalJumpTargets.length === 0) return;
    const idx = criticalCursor % criticalJumpTargets.length;
    const target = criticalJumpTargets[idx];
    jumpToSection(target.targetSection, target.level, target.targetIndex);
    setCriticalCursor((prev) => (prev + 1) % criticalJumpTargets.length);
  };
  const jumpToNextManual = () => {
    if (manualJumpTargets.length === 0) return;
    const idx = manualCursor % manualJumpTargets.length;
    const target = manualJumpTargets[idx];
    jumpToSection(target.targetSection, target.level, target.targetIndex);
    setManualCursor((prev) => (prev + 1) % manualJumpTargets.length);
  };

  useEffect(() => {
    if (criticalJumpTargets.length === 0) {
      setCriticalCursor(0);
      return;
    }
    if (criticalCursor >= criticalJumpTargets.length) {
      setCriticalCursor(0);
    }
  }, [criticalJumpTargets, criticalCursor]);
  useEffect(() => {
    if (manualJumpTargets.length === 0) {
      setManualCursor(0);
      return;
    }
    if (manualCursor >= manualJumpTargets.length) {
      setManualCursor(0);
    }
  }, [manualJumpTargets, manualCursor]);

  const criticalProgressLabel =
    criticalJumpTargets.length > 0
      ? `${((criticalCursor % criticalJumpTargets.length) + 1).toString()}/${criticalJumpTargets.length.toString()}`
      : "0/0";
  const manualProgressLabel =
    manualJumpTargets.length > 0
      ? `${((manualCursor % manualJumpTargets.length) + 1).toString()}/${manualJumpTargets.length.toString()}`
      : "0/0";
  const applyQuickPrompt = (text: string) => {
    setDraft(text);
    window.setTimeout(() => {
      focusChatInput();
    }, 0);
  };

  const applyActionRequiredOnlyPreset = () => {
    setCheckFilter("action_required");
    setCollapseInfoChecks(true);
  };

  const resetCheckViewPreset = () => {
    setCheckFilter("all");
    setCollapseInfoChecks(false);
  };
  const selectNextRecommendedTarget = () => {
    if (recommendedTargets.length < 2) return;
    const currentIndex = recommendedTargets.findIndex(
      (item) => item.target === activeTarget,
    );
    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + 1) % recommendedTargets.length;
    setActiveTarget(recommendedTargets[nextIndex].target);
  };

  useEffect(() => {
    showShortcutHelpRef.current = showShortcutHelp;
  }, [showShortcutHelp]);
  useEffect(() => {
    recommendedTargetsRef.current = recommendedTargets;
  }, [recommendedTargets]);
  useEffect(() => {
    activeTargetRef.current = activeTarget;
  }, [activeTarget]);

  const jumpToNextCriticalRef = useRef(jumpToNextCritical);
  jumpToNextCriticalRef.current = jumpToNextCritical;
  const jumpToNextManualRef = useRef(jumpToNextManual);
  jumpToNextManualRef.current = jumpToNextManual;
  const applyActionRequiredOnlyPresetRef = useRef(applyActionRequiredOnlyPreset);
  applyActionRequiredOnlyPresetRef.current = applyActionRequiredOnlyPreset;
  const applyBulkActionRequiredFixesRef = useRef(applyBulkActionRequiredFixes);
  applyBulkActionRequiredFixesRef.current = applyBulkActionRequiredFixes;
  const showToastForShortcutsRef = useRef(showToast);
  showToastForShortcutsRef.current = showToast;
  const autoFixableActionRequiredCountRef = useRef(autoFixableActionRequiredCount);
  autoFixableActionRequiredCountRef.current = autoFixableActionRequiredCount;
  const manualJumpTargetsLenRef = useRef(manualJumpTargets.length);
  manualJumpTargetsLenRef.current = manualJumpTargets.length;

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      return Boolean(target.closest("[contenteditable='true']"));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // 入力中はショートカットを奪わない
      if (isTypingTarget(e.target)) return;
      // Esc でショートカット凡例を閉じる
      if (e.key === "Escape" && showShortcutHelpRef.current) {
        e.preventDefault();
        setShowShortcutHelp(false);
        return;
      }
      // ? でショートカット凡例を開閉
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcutHelp((v) => !v);
        return;
      }
      // Ctrl/Cmd + Shift + J: 次の要修正へ
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        jumpToNextCriticalRef.current();
        return;
      }
      // Ctrl/Cmd + Shift + U: 要修正のみプリセット
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        applyActionRequiredOnlyPresetRef.current();
        showToastForShortcutsRef.current("公開前チェックを「要修正のみ」に切り替えました。");
        return;
      }
      // Ctrl/Cmd + Shift + F: 要修正の一括補完
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        if (autoFixableActionRequiredCountRef.current === 0) return;
        e.preventDefault();
        applyBulkActionRequiredFixesRef.current();
        return;
      }
      // Ctrl/Cmd + Shift + R: 次のおすすめ形式へ
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "r") {
        const list = recommendedTargetsRef.current;
        if (list.length < 2) return;
        e.preventDefault();
        const currentIndex = list.findIndex(
          (item) => item.target === activeTargetRef.current,
        );
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % list.length;
        setActiveTarget(list[nextIndex].target);
        showToastForShortcutsRef.current("次のおすすめ形式に切り替えました。");
        return;
      }
      // Ctrl/Cmd + Shift + M: 次の手動対応へ
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "m") {
        if (manualJumpTargetsLenRef.current === 0) return;
        e.preventDefault();
        jumpToNextManualRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!context || !exports) {
    return (
      <WorkspaceShell
        current="result"
        title="まだ生成されていません"
        subtitle="先にすべてのステップを完了し、プロトコル抽出を実行してください。"
      >
        <Card>
          <CardContent>
            <Link
              href="/onboarding"
              className={buttonClassName({ variant: "primary" })}
            >
              最初から始める
            </Link>
          </CardContent>
        </Card>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      current="result"
      title="あなた専用の実行型命令セット"
      subtitle="編集して、テストして、問題なければエクスポート。"
    >
      <div className="mb-4 rounded-md border border-ink-200 bg-ink-50/80 px-3 py-2 text-xs text-ink-700">
        進め方: 編集 → 要修正0件 → 保存反映 → テスト → エクスポート
      </div>
      <Card className="mb-6 border-ink-200 bg-white">
        <CardHeader>
          <CardTitle>はじめての方向け: 3ステップ</CardTitle>
          <CardDescription>
            編集内容を失わないための手順です。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-700">
            <li>編集モードでルールを修正する</li>
            <li>
              <strong>保存して反映</strong> を押す（ここで初めて確定）
            </li>
            <li>
              その後に <strong>プロファイル・データ</strong> メニューから{" "}
              <strong>バックアップ保存</strong> を押す
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card
        ref={editModeCardRef}
        className={
          "mb-6 scroll-mt-6 " +
          (editMode ? "border-accent/60 ring-2 ring-accent/20" : "")
        }
      >
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>編集モード</CardTitle>
                {editMode && (
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    編集中
                  </span>
                )}
              </div>
              <CardDescription>
                Priority Gate / Response Protocol / Taboos / Examples
                を手動で調整し、保存時に全ターゲットMarkdownを再生成します。
              </CardDescription>
            </div>
            {!editMode ? (
              <Button variant="secondary" onClick={() => setEditMode(true)}>
                編集モードに入る
              </Button>
            ) : (
              <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700">
                編集中です。下部の「変更を保存して反映する」で確定します。
              </div>
            )}
          </div>
        </CardHeader>
        {editMode && draftContext && (
          <CardContent className="border-t border-ink-200 bg-ink-100/60">
            <div className="mb-4 rounded-md border-l-4 border-accent bg-white/80 px-4 py-3 text-sm text-ink-700">
              ここでの変更はまだ確定していません。「変更を保存して反映する」で確定、「変更を破棄して戻る」で元に戻せます。
            </div>
            {hasUnsavedEditChanges ? (
              <div className="mb-4 rounded-md border border-signal-should/30 bg-signal-should/5 px-4 py-3 text-sm text-signal-should">
                <strong className="block mb-1">未保存の変更があります</strong>
                <p>
                  いまの編集内容は <strong>変更を保存して反映する</strong>{" "}
                  を押すまで確定しません。「プロファイル・データ」内のバックアップ保存にも含まれません。
                </p>
                {editDiffSummary.length > 0 && (
                  <p className="mt-2 text-xs leading-relaxed text-ink-700">
                    変更プレビュー: {editDiffSummary.join(" / ")}
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-4 rounded-md border border-ink-200 bg-white/80 px-4 py-3 text-sm text-ink-600">
                変更はまだありません。入力を始めると保存ボタンが有効になります。
              </div>
            )}
            {editError && (
              <div className="mb-4 rounded-md border border-signal-must/30 bg-signal-must/5 px-4 py-3 text-sm text-signal-must">
                {editError}
              </div>
            )}
            <nav
              className="mb-4 flex flex-col gap-2 border-b border-ink-200 pb-3 sm:sticky sm:top-3 sm:z-10 sm:rounded-lg sm:border sm:border-ink-200 sm:bg-ink-50/95 sm:p-3 sm:pb-3 sm:shadow-sm sm:backdrop-blur"
              aria-label="編集セクションへ移動"
            >
              <span className="text-[11px] font-medium text-ink-500">
                セクションへ移動
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="border border-dashed border-ink-300 bg-white/80"
                  onClick={scrollToEditModeCardTop}
                >
                  編集モードの上へ
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => jumpToSection("priority", "info", undefined)}
                >
                  Priority Gate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => jumpToSection("response", "info", undefined)}
                >
                  Response Protocol
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => jumpToSection("taboos", "info", undefined)}
                >
                  Taboos
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => jumpToSection("examples", "info", undefined)}
                >
                  Examples
                </Button>
              </div>
            </nav>
            <div className="grid gap-6 lg:grid-cols-3">
              <div
                ref={priorityRef}
                className={
                  sectionHighlightClass(
                    highlightSection === "priority",
                    highlightTone,
                  ) + " scroll-mt-20 sm:scroll-mt-36"
                }
              >
                <EditorSection
                  title="Priority Gate"
                  onAdd={() => addGate()}
                  onFillExamples={fillPriorityExamples}
                  canFillExamples={canFillPriorityExamples}
                >
                {draftContext.priorityGates.map((g, i) => (
                  <EditorCard
                    key={g.id}
                    title={`Gate ${i + 1}`}
                    onRemove={() => removeGate(i)}
                    section="priority"
                    index={i}
                    highlighted={
                      highlightSection === "priority" &&
                      highlightIndex === i
                    }
                  >
                    <Label>When</Label>
                    <Textarea
                      value={g.when}
                      onChange={(v) => updateGate(i, "when", v)}
                      placeholder={
                        PRIORITY_WHEN_PLACEHOLDERS[
                          i % PRIORITY_WHEN_PLACEHOLDERS.length
                        ]
                      }
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Choose（優先する）</Label>
                        <Input
                          value={g.choose}
                          onChange={(v) => updateGate(i, "choose", v)}
                          placeholder={
                            PRIORITY_CHOOSE_PLACEHOLDERS[
                              i % PRIORITY_CHOOSE_PLACEHOLDERS.length
                            ]
                          }
                        />
                      </div>
                      <div>
                        <Label>Over（比較対象）</Label>
                        <Input
                          value={g.over}
                          onChange={(v) => updateGate(i, "over", v)}
                          placeholder={
                            PRIORITY_OVER_PLACEHOLDERS[
                              i % PRIORITY_OVER_PLACEHOLDERS.length
                            ]
                          }
                        />
                      </div>
                    </div>
                    <Label>Rationale</Label>
                    <Textarea
                      value={g.rationale}
                      onChange={(v) => updateGate(i, "rationale", v)}
                      placeholder={
                        PRIORITY_RATIONALE_PLACEHOLDERS[
                          i % PRIORITY_RATIONALE_PLACEHOLDERS.length
                        ]
                      }
                    />
                    <IntensitySelect
                      value={g.intensity}
                      onChange={(v) => updateGate(i, "intensity", v)}
                    />
                  </EditorCard>
                ))}
                </EditorSection>
              </div>

              <div
                ref={responseRef}
                className={
                  sectionHighlightClass(
                    highlightSection === "response",
                    highlightTone,
                  ) + " scroll-mt-20 sm:scroll-mt-36"
                }
              >
                <EditorSection
                  title="Response Protocol"
                  onAdd={() => addRule("responseProtocol")}
                  onFillExamples={() => fillRuleExamples("responseProtocol")}
                  canFillExamples={canFillResponseExamples}
                >
                {draftContext.responseProtocol.rules.map((r, i) => (
                  <EditorCard
                    key={`rp-${i}`}
                    title={`Rule ${i + 1}`}
                    onRemove={() => removeRule("responseProtocol", i)}
                    section="response"
                    index={i}
                    highlighted={
                      highlightSection === "response" &&
                      highlightIndex === i
                    }
                  >
                    <Textarea
                      value={r.statement}
                      onChange={(v) =>
                        updateRule("responseProtocol", i, "statement", v)
                      }
                      placeholder={
                        RESPONSE_RULE_PLACEHOLDERS[
                          i % RESPONSE_RULE_PLACEHOLDERS.length
                        ]
                      }
                    />
                    <IntensitySelect
                      value={r.intensity}
                      onChange={(v) =>
                        updateRule("responseProtocol", i, "intensity", v)
                      }
                    />
                  </EditorCard>
                ))}
                </EditorSection>
              </div>

              <div
                ref={taboosRef}
                className={
                  sectionHighlightClass(
                    highlightSection === "taboos",
                    highlightTone,
                  ) + " scroll-mt-20 sm:scroll-mt-36"
                }
              >
                <EditorSection
                  title="Taboos"
                  onAdd={() => addRule("taboos")}
                  onFillExamples={() => fillRuleExamples("taboos")}
                  canFillExamples={canFillTabooExamples}
                >
                {draftContext.taboos.map((r, i) => (
                  <EditorCard
                    key={`tb-${i}`}
                    title={`Taboo ${i + 1}`}
                    onRemove={() => removeRule("taboos", i)}
                    section="taboos"
                    index={i}
                    highlighted={
                      highlightSection === "taboos" &&
                      highlightIndex === i
                    }
                  >
                    <Textarea
                      value={r.statement}
                      onChange={(v) => updateRule("taboos", i, "statement", v)}
                      placeholder={
                        TABOO_RULE_PLACEHOLDERS[
                          i % TABOO_RULE_PLACEHOLDERS.length
                        ]
                      }
                    />
                    <IntensitySelect
                      value={r.intensity}
                      onChange={(v) => updateRule("taboos", i, "intensity", v)}
                    />
                  </EditorCard>
                ))}
                </EditorSection>
              </div>
            </div>

            <div
              ref={examplesRef}
              className={
                "mt-6 scroll-mt-20 sm:scroll-mt-36 " +
                sectionHighlightClass(
                  highlightSection === "examples",
                  highlightTone,
                )
              }
            >
              <p className="mb-3 rounded-md border border-ink-200 bg-white px-3 py-2 text-xs leading-relaxed text-ink-600">
                音声入力や会話の書き起こしをそのまま使って構いません。似た表現が並んでも、強調や話し方の癖として個性として残す判断で問題ありません。Taboos／Response
                Protocol の「命令の重複」とは役割が異なり、Examples の重複を指摘するチェックはありません。
              </p>
              <EditorSection
                title="Examples（Good / Bad）"
                onAdd={addExample}
                onFillExamples={fillExamplePlaceholders}
                canFillExamples={canFillExamplePlaceholders}
              >
                {draftContext.examples.length === 0 ? (
                  <p className="rounded-md border border-dashed border-ink-200 bg-white px-3 py-4 text-xs text-ink-600">
                    まだ例がありません。「+ 追加」でシナリオ別の望ましい／避けたい振る舞いを登録できます（Markdownの
                    Examples セクションに反映されます）。会話調のままでも登録して大丈夫です。
                  </p>
                ) : (
                  draftContext.examples.map((ex, i) => (
                    <EditorCard
                      key={`ex-${i}`}
                      title={`Example ${i + 1}`}
                      onRemove={() => removeExample(i)}
                      section="examples"
                      index={i}
                      highlighted={
                        highlightSection === "examples" &&
                        highlightIndex === i
                      }
                    >
                      <Label>シナリオ（いつ・どんな状況か）</Label>
                      <Textarea
                        value={ex.scenario}
                        onChange={(v) => updateExample(i, "scenario", v)}
                        placeholder="例: 上長から短期売上を急かされるが、品質も落とせないと言われた"
                      />
                      <Label>Good（望ましい振る舞い）</Label>
                      <Textarea
                        value={ex.good}
                        onChange={(v) => updateExample(i, "good", v)}
                        placeholder="例: まず守る数値を確認し、トレードオフを2案に絞って提案する"
                      />
                      <Label>Bad（避けたい振る舞い）</Label>
                      <Textarea
                        value={ex.bad}
                        onChange={(v) => updateExample(i, "bad", v)}
                        placeholder="例: どちらも大事と述べるだけで優先順位を決めない"
                      />
                    </EditorCard>
                  ))
                )}
              </EditorSection>
            </div>

            <div className="mt-6 rounded-lg border border-ink-200 bg-ink-50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDraftContext(context);
                    setEditError("");
                    setPreviewDraft(false);
                    setShowSaveConfirm(false);
                    setEditMode(false);
                    showToast(
                      hasUnsavedEditChanges
                        ? "変更を破棄しました。"
                        : "編集モードを終了しました。",
                    );
                  }}
                >
                  {hasUnsavedEditChanges ? "変更を破棄して戻る" : "編集モードを終了"}
                </Button>
                <Button
                  className={
                    actionRequiredCount === 0 && hasUnsavedEditChanges
                      ? "ring-2 ring-signal-may/50 ring-offset-1"
                      : undefined
                  }
                  disabled={!hasUnsavedEditChanges}
                  onClick={requestSaveEdits}
                >
                  変更を保存して反映する
                </Button>
              </div>
              <p className="mt-2 text-xs text-ink-500 sm:text-right">
                {hasUnsavedEditChanges
                  ? "保存前は下書きです。確定するには「変更を保存して反映する」を押してください。"
                  : "未保存の変更はありません。変更すると保存ボタンが有効になります。"}
              </p>
            </div>
            {showSaveConfirm && (
              <div className="mt-4 rounded-lg border border-ink-300 bg-white p-4">
                <p className="text-sm font-medium text-ink-900">保存前の最終確認</p>
                <p className="mt-1 text-xs text-ink-600">
                  要修正 {actionRequiredCount}件 / 手動対応 {manualActionRequiredCount}件 / 変更点{" "}
                  {editDiffSummary.length > 0 ? editDiffSummary.join(" / ") : "なし"}
                </p>
                {unresolvedManualChecks.length > 0 && (
                  <p className="mt-2 text-xs text-ink-600">
                    未解決の手動対応:{" "}
                    {unresolvedManualChecks.map((c) => c.title).join(" / ")}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowSaveConfirm(false)}
                  >
                    戻る
                  </Button>
                  <Button size="sm" onClick={saveEdits}>
                    この内容で保存
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
      {!editMode && showPostSaveActions && (
        <Card className="mb-8 border-signal-may/30 bg-signal-may/5">
          <CardContent>
            <div className="flex flex-col gap-2 py-1 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-ink-800">
                保存反映が完了しました。次の操作へ進めます。
              </p>
              <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
                <Button size="sm" variant="secondary" onClick={scrollToExportCardTop}>
                  エクスポートへ
                </Button>
                <Button size="sm" variant="secondary" onClick={scrollToTestCardTop}>
                  テスト実行へ
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {editMode && (
        <div className="fixed bottom-4 left-4 z-40 rounded-md border border-accent/40 bg-white/95 px-3 py-2 text-xs text-ink-800 shadow-lab backdrop-blur">
          <strong className="mr-1 text-accent">編集中</strong>
          保存で確定 / 破棄で元に戻る
        </div>
      )}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-40 rounded-md border border-ink-200 bg-white/95 px-3 py-2 text-sm text-ink-800 shadow-lab backdrop-blur">
          {toastMessage}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>公開前チェック</CardTitle>
              {isPublishReady && (
                <span className="rounded-full border border-signal-may/40 bg-signal-may/10 px-2 py-0.5 text-xs font-medium text-ink-800">
                  公開準備OK
                </span>
              )}
            </div>
            {isPublishReady && !showPostSaveActions && (
              <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
                <Button size="sm" variant="secondary" onClick={scrollToExportCardTop}>
                  エクスポートへ
                </Button>
                <Button size="sm" variant="secondary" onClick={scrollToTestCardTop}>
                  テスト実行へ
                </Button>
              </div>
            )}
          </div>
          <CardDescription>
            配布前の最終チェックです。要修正を0件にしてから共有してください。
            <br />
            情報が増えるほどAIはあなたに近づきます。まずは最小限で大丈夫です。
            <br />
            <Link
              href="/help/glossary"
              className="text-accent underline-offset-2 hover:underline"
            >
              用語ミニヘルプ
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={
              "mb-3 rounded-lg border px-3 py-3 " +
              (isPublishReady
                ? "border-signal-may/40 bg-signal-may/10"
                : "border-signal-should/40 bg-signal-should/10")
            }
          >
            <p className="text-sm font-semibold text-ink-900">
              公開準備: {isPublishReady ? "Ready" : "Needs Attention"}
            </p>
            <p className="mt-1 text-xs text-ink-700">
              ブロッカー {actionRequiredCount}件 / 手動確認 {manualActionRequiredCount}
              件 / 確認済み {infoCount}件 / 反映状態{" "}
              {editMode
                ? hasUnsavedEditChanges
                  ? "未保存の変更あり"
                  : "未保存の変更なし"
                : "保存済み"}
            </p>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <StatusPill tone="critical" label={`要対応 ${actionRequiredCount}件`} />
            <StatusPill tone="warning" label={`手動確認 ${manualActionRequiredCount}件`} />
            <StatusPill tone="ok" label={`確認済み ${infoCount}件`} />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={checkFilter === "action_required" ? "primary" : "ghost"}
              onClick={applyActionRequiredOnlyPreset}
            >
              要対応 ({actionRequiredCount})
            </Button>
            <Button
              size="sm"
              variant={checkFilter === "info_only" ? "primary" : "ghost"}
              onClick={() => {
                setCheckFilter("info_only");
                setCollapseInfoChecks(false);
              }}
            >
              確認済み ({infoCount})
            </Button>
            <Button
              size="sm"
              variant={checkFilter === "all" ? "secondary" : "ghost"}
              onClick={resetCheckViewPreset}
            >
              すべて
            </Button>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-1">
            <Button
              size="sm"
              variant="secondary"
              disabled={criticalJumpTargets.length === 0}
              onClick={jumpToNextCritical}
            >
              次の要修正へ ({criticalProgressLabel})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={manualJumpTargets.length === 0}
              onClick={jumpToNextManual}
            >
              次の手動対応へ ({manualProgressLabel})
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={autoFixableActionRequiredCount === 0}
              title={
                autoFixableActionRequiredCount > 0
                  ? "自動補完できる要修正をまとめて補完"
                  : "自動補完できる要修正はありません"
              }
              onClick={applyBulkActionRequiredFixes}
            >
              要修正を一括補完 ({autoFixableActionRequiredCount.toString()})
            </Button>
            <Button
              size="sm"
              variant={showShortcutHelp ? "secondary" : "ghost"}
              onClick={() => setShowShortcutHelp((v) => !v)}
              title="ショートカット表示（?）"
            >
              ショートカット
            </Button>
          </div>

          {showShortcutHelp && (
            <div className="mb-2 rounded-md border border-ink-200 bg-white px-3 py-2 text-[11px] leading-relaxed text-ink-600">
              <span className="font-medium text-ink-800">キー:</span>{" "}
              <span className="font-mono">J</span> 要修正へ /{" "}
              <span className="font-mono">M</span> 手動対応へ /{" "}
              <span className="font-mono">U</span> 要修正のみ /{" "}
              <span className="font-mono">F</span> 一括補完 /{" "}
              <span className="font-mono">?</span> 開閉 /{" "}
              <span className="font-mono">Esc</span> 閉じる
            </div>
          )}
          {actionRequiredCount === 0 && (
            <div className="mb-2 rounded-md border border-signal-may/30 bg-signal-may/5 px-3 py-2 text-xs text-ink-700">
              要修正はありません。内容を確認して、最後に「変更を保存して反映する」で確定してください。
            </div>
          )}
          <div className="space-y-2">
            {prioritizedVisibleQualityChecks.map((check) => (
              <div
                key={check.id}
                role={check.targetSection ? "button" : undefined}
                tabIndex={check.targetSection ? 0 : undefined}
                aria-label={
                  check.targetSection
                    ? `${check.title}。クリックで編集箇所へ移動`
                    : check.title
                }
                onClick={() =>
                  check.targetSection
                    ? jumpToSection(
                        check.targetSection,
                        check.level,
                        check.targetIndex,
                      )
                    : undefined
                }
                onKeyDown={(e) => {
                  if (!check.targetSection) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    jumpToSection(
                      check.targetSection,
                      check.level,
                      check.targetIndex,
                    );
                  }
                }}
                aria-disabled={!check.targetSection}
                className={
                  "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 " +
                  (check.level === "critical" || check.level === "warning"
                    ? "border-signal-must/30 bg-signal-must/5 text-signal-must hover:bg-signal-must/10"
                    : "border-signal-may/30 bg-signal-may/5 text-signal-may hover:bg-signal-may/10") +
                  (check.targetSection ? " cursor-pointer" : " cursor-default")
                }
              >
                <p className="font-medium">{check.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed">{check.detail}</p>
                {CHECK_REASON_LABEL[check.id] && (
                  <p className="mt-1 text-[11px] font-medium opacity-85">
                    {CHECK_REASON_LABEL[check.id]}
                  </p>
                )}
                {check.targetSection && (
                  <p className="mt-1 text-[11px] opacity-80">
                    クリックで編集箇所へ移動
                  </p>
                )}
                {check.recommendedAction && (
                  <p className="mt-1 text-[11px] font-medium opacity-90">
                    推奨アクション: {check.recommendedAction}
                  </p>
                )}
                {(check.level === "critical" || check.level === "warning") && (
                  <p className="mt-1 text-[11px] opacity-85">
                    {canAutoFixCheck(check)
                      ? "自動補完: 対応"
                      : "自動補完: 対象外（手動対応）"}
                  </p>
                )}
                {(check.level === "critical" || check.level === "warning") &&
                  !canAutoFixCheck(check) &&
                  MANUAL_FIX_TEMPLATES[check.id] && (
                    <div className="mt-1">
                      <p className="text-[11px] leading-relaxed opacity-90">
                        修正テンプレ: {MANUAL_FIX_TEMPLATES[check.id]}
                      </p>
                      <div className="mt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyManualTemplate(MANUAL_FIX_TEMPLATES[check.id]);
                          }}
                        >
                          テンプレをコピー
                        </Button>
                      </div>
                    </div>
                  )}
                {(check.level === "critical" || check.level === "warning") &&
                  !canAutoFixCheck(check) && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          recheckSingleItem(check);
                        }}
                      >
                        修正後チェック
                      </Button>
                    </div>
                  )}
                {(check.level === "critical" || check.level === "warning") &&
                  canAutoFixCheck(check) && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        title="この要修正項目だけを自動補完"
                        onClick={(e) => {
                          e.stopPropagation();
                          applySingleCheckFix(check);
                        }}
                      >
                        この項目だけ補完
                      </Button>
                    </div>
                  )}
              </div>
            ))}
            {prioritizedVisibleQualityChecks.length === 0 && (
              <div className="rounded-md border border-ink-200 bg-white px-3 py-3 text-xs text-ink-500">
                このフィルタ条件では表示対象がありません。
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 上部サマリー（Priority / Response / Taboos） */}
      <Card className="mb-6 border-ink-900/10 bg-ink-900 text-white">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-white">
            EXECUTION SUMMARY — 実行型プロトコルの要約
          </CardTitle>
          <CardDescription className="text-ink-200">
            Priority Gate だけでなく、応答ルールと禁忌もここで確認できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold tracking-tightish text-white">
                PRIORITY GATES — 志向の優先順位
              </h3>
              <p className="mb-3 text-xs text-ink-300">
                迷ったらこれを選べ（判断の分岐ルール）
              </p>
              <div className="space-y-3">
                {activeContext?.priorityGates.map((g) => (
                  <div key={g.id} className="rounded-md border border-white/10 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <IntensityBadge intensity={g.intensity} />
                      <div className="text-xs text-ink-200">{g.when}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-baseline gap-2 text-sm">
                      <span className="rounded-md bg-accent px-2 py-1 font-mono font-bold">
                        {g.choose}
                      </span>
                      <span className="text-ink-300">＞</span>
                      <span className="font-mono text-ink-300">
                        {g.over}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold tracking-tightish text-white">
                RESPONSE PROTOCOL — 応答ルール
              </h3>
              <p className="mb-3 text-xs text-ink-300">
                AIに守らせる回答の型（結論順・文量・文体）
              </p>
              <div className="space-y-2">
                {activeContext?.responseProtocol.rules.map((r, i) => (
                  <div key={`summary-rp-${i}`} className="rounded-md border border-white/10 p-3">
                    <div className="mb-1">
                      <IntensityBadge intensity={r.intensity} />
                    </div>
                    <p className="text-xs leading-relaxed text-ink-100">
                      {r.statement}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold tracking-tightish text-white">
                TABOOS — 禁忌
              </h3>
              <p className="mb-3 text-xs text-ink-300">
                絶対に言わない・やらないこと
              </p>
              <div className="space-y-2">
                {activeContext?.taboos.map((t, i) => (
                  <div key={`summary-taboo-${i}`} className="rounded-md border border-white/10 p-3">
                    <div className="mb-1">
                      <IntensityBadge intensity={t.intensity} />
                    </div>
                    <p className="text-xs leading-relaxed text-ink-100">{t.statement}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
            <h3 className="mb-2 text-sm font-semibold tracking-tightish text-white">
              EXAMPLES — Good / Bad
            </h3>
            <p className="mb-3 text-xs text-ink-300">
              シナリオ別の望ましい回答と避けたい回答の対比。音声・会話の書き起こしでも、そのまま反映して問題ありません。
            </p>
            {!activeContext?.examples.length ? (
              <p className="text-xs text-ink-400">
                まだ例がありません。編集モードの Examples で追加すると、ここと Markdown に反映されます。
              </p>
            ) : (
              <div className="space-y-3">
                {activeContext.examples.map((ex, i) => (
                  <div
                    key={`summary-ex-${i}`}
                    className="rounded-md border border-white/10 p-3"
                  >
                    <p className="mb-2 text-xs font-medium text-ink-200">
                      {ex.scenario.trim() || `Example ${i + 1}`}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded border border-signal-may/20 bg-signal-may/5 p-2">
                        <p className="mb-1 text-[10px] uppercase text-ink-400">
                          Good
                        </p>
                        <p className="text-xs leading-relaxed text-ink-100">
                          {ex.good}
                        </p>
                      </div>
                      <div className="rounded border border-signal-must/20 bg-signal-must/5 p-2">
                        <p className="mb-1 text-[10px] uppercase text-ink-400">
                          Bad
                        </p>
                        <p className="text-xs leading-relaxed text-ink-100">
                          {ex.bad}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        {/* 左: ターゲット別 Markdown */}
        <div ref={exportCardRef} className="min-w-0">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
              <CardTitle>エクスポート</CardTitle>
              {editMode && (
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  variant={previewingUnsaved ? "primary" : "secondary"}
                  onClick={() => setPreviewDraft((v) => !v)}
                >
                  {previewingUnsaved
                    ? "保存済み表示に戻す"
                    : "未保存の下書きをプレビュー"}
                </Button>
              )}
            </div>
            <CardDescription>
              ターゲット AI 別に最適化された Markdown。コピー or ダウンロード可能。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-700">
              出力形式: {TARGET_LABEL[activeTarget]} / ファイル名:{" "}
              {previewingUnsaved
                ? TARGET_FILENAME[activeTarget].replace(".md", ".draft.md")
                : TARGET_FILENAME[activeTarget]}
              {" / "}公開状態: {exportStatusLabel}
            </div>
            <div className="mb-4 rounded-lg border border-accent/20 bg-accent/5 p-3">
              <p className="text-sm font-medium text-ink-900">
                タグに基づくおすすめエクスポート
              </p>
              <p className="mt-1 text-[11px] text-ink-600">
                現在選択: {TARGET_LABEL[activeTarget]}
                {topRecommendedTarget
                  ? ` / ${topIsStrongRecommendation ? "おすすめ" : "候補"}1位: ${TARGET_LABEL[topRecommendedTarget]}`
                  : ""}
              </p>
              {topRecommendedReason && (
                <p className="mt-1 text-[11px] text-ink-500">
                  1位の理由: {topRecommendedReason}
                </p>
              )}
              <p className="mb-2 mt-1 text-xs text-ink-600">
                {currentProfile && (currentProfile.tags?.length ?? 0) > 0
                  ? "タグから用途に合う形式を推奨順で表示します。"
                  : "タグ未設定のため、推奨精度はまだ低めです。"}
              </p>
              <p className="mb-3 text-[11px] text-ink-500">
                {currentProfile && (currentProfile.tags?.length ?? 0) > 0
                  ? `現在のプロファイルタグ（${(currentProfile.tags ?? []).join(" / ")}）を基に、使う可能性が高い形式を推奨しています。`
                  : "プロファイルにタグを追加すると、用途に合う候補を優先表示できます。"}
              </p>
              {recommendedTargets.length > 0 ? (
                <div className="space-y-2">
                  {recommendedTargets.length > 3 && (
                    <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                      <p className="text-[11px] text-ink-500">
                        上位3件を優先表示しています。
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAllRecommendations((v) => !v)}
                      >
                        {showAllRecommendations ? "上位3件に戻す" : "すべて表示"}
                      </Button>
                    </div>
                  )}
                  {topRecommendedTarget && activeTarget !== topRecommendedTarget && (
                    <div className="flex w-full flex-wrap justify-start gap-2 sm:justify-end">
                      {recommendedTargets.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={selectNextRecommendedTarget}
                          title="次のおすすめへ（Ctrl/Cmd + Shift + R）"
                        >
                          次のおすすめへ
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setActiveTarget(topRecommendedTarget);
                          showToast("おすすめを適用しました。");
                        }}
                      >
                        1位を選択
                      </Button>
                    </div>
                  )}
                  {displayedRecommendations.map((item, idx) => (
                    <button
                      key={item.target}
                      type="button"
                      onClick={() => setActiveTarget(item.target)}
                      className={
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors " +
                        (activeTarget === item.target
                          ? "border-ink-900 bg-ink-900 text-white"
                          : idx < 3
                            ? "border-accent/30 bg-white text-ink-800 hover:bg-ink-50"
                            : "border-ink-200 bg-white text-ink-800 hover:bg-ink-50")
                      }
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-1">
                          <p className="text-sm font-medium">
                            {idx + 1}位: {TARGET_LABEL[item.target]}
                          </p>
                          {idx === 0 && item.score >= 60 && (
                            <span
                              className={
                                "rounded-full border px-1.5 py-0.5 text-[10px] " +
                                (activeTarget === item.target
                                  ? "border-white/40 text-white/90"
                                  : "border-accent/30 bg-accent/10 text-accent")
                              }
                            >
                              おすすめ
                            </span>
                          )}
                          {activeTarget === item.target && (
                            <span
                              className={
                                "rounded-full border px-1.5 py-0.5 text-[10px] " +
                                (activeTarget === item.target
                                  ? "border-white/40 text-white/90"
                                  : "border-ink-300 bg-white text-ink-700")
                              }
                            >
                              選択中
                            </span>
                          )}
                        </div>
                        <p
                          className={
                            "text-xs " +
                            (activeTarget === item.target
                              ? "text-ink-200"
                              : "text-ink-500")
                          }
                        >
                          {TARGET_REASON_TAG[item.target]} / {item.reason}
                        </p>
                        <p
                          className={
                            "text-[11px] " +
                            (activeTarget === item.target
                              ? "text-ink-300"
                              : "text-ink-500")
                          }
                        >
                          {TARGET_USAGE_HINT[item.target]}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-ink-200 bg-white px-3 py-2 text-xs text-ink-600">
                  プロファイルにタグを追加すると、用途に合う形式を優先表示できます。{" "}
                  <Link href="/profiles" className="text-accent underline-offset-2 hover:underline">
                    プロファイル設定へ
                  </Link>
                </div>
              )}
            </div>
            {previewingUnsaved && (
              <div className="mb-3 rounded-md border border-signal-should/30 bg-signal-should/5 px-3 py-2 text-xs text-signal-should">
                これは未保存の下書きプレビューです。正式反映するには「保存して反映」を押してください。
              </div>
            )}
            {showExportRiskConfirm && (
              <div className="mb-3 rounded-md border border-signal-should/40 bg-signal-should/10 px-3 py-2 text-xs text-ink-700">
                要修正が {actionRequiredCount} 件あります。この状態でエクスポートしますか？
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowExportRiskConfirm(false)}
                  >
                    戻って修正
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowExportRiskConfirm(false);
                      doDownload();
                    }}
                  >
                    そのままダウンロード
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-start gap-2">
              {orderedTargetButtons.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTarget(t)}
                  className={
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm " +
                    (activeTarget === t
                      ? "border-ink-900 bg-ink-900 text-white"
                      : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50")
                  }
                >
                  {TARGET_LABEL[t]}
                </button>
              ))}
            </div>
            {exportHeadings.length > 0 && (
              <nav
                className="mt-4 border-t border-ink-200 pt-4"
                aria-label="エクスポートプレビューの見出し"
              >
                <p className="mb-2.5 text-sm font-medium text-ink-800">
                  見出しへ移動
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {exportHeadings.map((h) => (
                    <button
                      key={`${h.text}-${h.line.toString()}`}
                      type="button"
                      onClick={() => scrollPreviewToHeading(h.line)}
                      title={h.text}
                      className="max-w-full rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 sm:text-sm"
                    >
                      {h.label.length > 22
                        ? `${h.label.slice(0, 22)}…`
                        : h.label}
                    </button>
                  ))}
                </div>
              </nav>
            )}
            <pre
              ref={exportPreviewRef}
              className={
                (exportHeadings.length > 0 ? "mt-4 " : "mt-3 ") +
                "max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-ink-200 bg-ink-50 p-4 font-mono text-[12px] leading-relaxed text-ink-800 sm:whitespace-pre"
              }
            >
              {displayedMarkdown}
            </pre>
            <div className="mt-3 flex flex-wrap items-center justify-start gap-2 sm:justify-end">
              <Button
                size="sm"
                className="w-full sm:w-auto"
                variant="secondary"
                onClick={onCopy}
                disabled={!displayedMarkdown.trim()}
              >
                クリップボードへコピー
              </Button>
              <Button size="sm" className="w-full sm:w-auto" variant="ghost" onClick={onCopyFilename}>
                ファイル名をコピー
              </Button>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={onDownload}
                disabled={!displayedMarkdown.trim()}
              >
                .md でダウンロード
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* 右: テスト実行 */}
        <div ref={testCardRef} className="min-w-0">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
              <CardTitle>テスト実行</CardTitle>
              <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
                <Button size="sm" variant="ghost" onClick={focusChatInput}>
                  入力へ
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearChatHistory}
                  disabled={chat.length === 0 && !chatError && !chatStubNotice}
                >
                  クリア
                </Button>
              </div>
            </div>
            <CardDescription>
              選択中のプロンプト ({TARGET_LABEL[activeTarget]}) を AI に注入して、その場で振る舞いを確認。
              <Link
                href="/help/glossary"
                className="ml-1 text-accent underline-offset-2 hover:underline"
              >
                用語ヘルプ
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 rounded-lg border border-ink-200 bg-white px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-ink-700">
                    保留3項目
                  </p>
                  <span className="rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[11px] text-ink-600">
                    {pendingChecksRemaining === 0
                      ? "完了"
                      : `残り${pendingChecksRemaining}件`}
                  </span>
                  {pendingChecksRemaining > 0 && !showPendingTestDetails && (
                    <span className="text-[11px] text-ink-500">
                      {pendingRemainingLabels}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono text-ink-500">
                    {verifiedPendingChecksCount} / {PENDING_TEST_CHECKS.length}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPendingTestDetails((v) => !v)}
                  >
                    {showPendingTestDetails ? "閉じる" : "詳細"}
                  </Button>
                </div>
              </div>
              {showPendingTestDetails && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={completePendingTestChecks}>
                      一括で検証済み
                    </Button>
                    <Button size="sm" variant="ghost" onClick={resetPendingTestChecks}>
                      未検証に戻す
                    </Button>
                  </div>
                  {PENDING_TEST_CHECKS.map((item) => {
                    const verified = pendingTestCheckStatus[item.id];
                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink-100 bg-ink-50 px-2 py-1.5"
                      >
                        <span className="text-xs text-ink-700">{item.label}</span>
                        <Button
                          size="sm"
                          variant={verified ? "secondary" : "ghost"}
                          onClick={() => togglePendingTestCheck(item.id)}
                        >
                          {verified ? "検証済み" : "未検証"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {chatStubNotice ? (
              <div className="mb-3 rounded-md border border-signal-should/40 bg-signal-should/10 px-3 py-2 text-xs font-medium leading-relaxed text-signal-should">
                {chatStubNotice}
              </div>
            ) : null}
            <div className="max-h-[40vh] space-y-3 overflow-y-auto rounded-lg border border-ink-200 bg-ink-50 p-4">
              {chat.length === 0 && (
                <div className="rounded-md border border-accent/25 bg-white px-3 py-2">
                  <p className="text-sm font-medium text-ink-900">ここで回答の雰囲気を確認できます</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-600">
                    質問を入力して送信すると、現在選択中のプロンプト設定での回答をすぐに試せます。
                  </p>
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i}>
                  {m.role === "model" && /^\[[^\]]+\]\n/.test(m.text) ? (
                    <div className="max-w-[92%] rounded-lg border border-accent/30 bg-white px-3 py-2 text-sm text-ink-900">
                      <p className="mb-1 inline-flex rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                        {m.text.split("\n")[0].replace(/^\[|\]$/g, "")}
                      </p>
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {m.text.split("\n").slice(1).join("\n")}
                      </p>
                    </div>
                  ) : (
                    <div
                      className={
                        m.role === "user"
                          ? "ml-auto max-w-[85%] rounded-lg bg-ink-900 px-3 py-2 text-sm text-white"
                          : "max-w-[85%] rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 whitespace-pre-wrap"
                      }
                    >
                      {m.text}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {chatError && (
              <div className="mt-2 text-xs text-signal-must">{chatError}</div>
            )}
            <div className="mt-3 rounded-lg border border-ink-200 bg-white p-3">
              <p className="text-xs font-medium text-ink-700">テスト入力</p>
              <p className="mt-1 text-[11px] text-ink-500">
                長文でもそのまま貼り付けできます。Enterで送信、Shift+Enterで改行です。
              </p>
              <div className="mt-2 w-full min-w-0 overflow-hidden">
                <textarea
                  ref={chatInputRef}
                  rows={3}
                  className="block w-full min-w-0 max-w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-ink-900"
                  style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSendChat();
                    }
                  }}
                  placeholder="例: 新サービスの月額価格、3万円で行こうと思う。どう思う？"
                />
              </div>
              <div className="mt-2 grid w-full justify-items-end gap-2 sm:flex sm:flex-wrap sm:justify-end">
                <Button className="w-auto" onClick={onSendChat} disabled={running || !draft.trim()}>
                  {running ? "送信中..." : "送信"}
                </Button>
                <Button
                  className="w-auto"
                  variant="secondary"
                  onClick={compareTopTwoRecommendations}
                  disabled={running || !compareMessage || comparePair.length < 2}
                  title={
                    compareDisabledReason ||
                    "おすすめ1位・2位（または代替2形式）で同じ質問を一度に比較"
                  }
                >
                  1位/2位を比較
                </Button>
              </div>
              {(quickTestPrompts.length > 0 || hasComparisonEntries) && (
                <div className="mt-2">
                  <div className="flex justify-end">
                    <Button
                      className="w-full sm:w-auto"
                      variant="ghost"
                      onClick={() => setShowTestHelpers((v) => !v)}
                      title={hasComparisonEntries ? "入力例と比較補助" : "入力例"}
                    >
                      {showTestHelpers
                        ? hasComparisonEntries
                          ? "入力例・比較を閉じる"
                          : "入力例を閉じる"
                        : hasComparisonEntries
                          ? "入力例・比較を開く"
                          : "入力例を開く"}
                    </Button>
                  </div>
                  {showTestHelpers && (
                    <div className="mt-2 space-y-2 rounded-md border border-ink-100 bg-ink-50 p-2">
                      {quickTestPrompts.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-ink-500">入力補助:</span>
                          {quickTestPrompts.map((prompt, idx) => (
                            <Button
                              key={`${prompt}-${idx.toString()}`}
                              size="sm"
                              variant="ghost"
                              onClick={() => applyQuickPrompt(prompt)}
                              title={prompt}
                            >
                              例{idx + 1}
                            </Button>
                          ))}
                        </div>
                      )}
                      {hasComparisonEntries && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-ink-500">比較補助:</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={downloadComparisonMarkdown}
                            title="比較結果をMarkdownで保存"
                          >
                            比較を保存
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={clearComparisonResults}
                            title="比較実行で追加した履歴だけを削除"
                          >
                            比較をクリア
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-2 grid gap-2 text-[11px] text-ink-600 sm:grid-cols-2">
              <div className="rounded-md border border-ink-200 bg-ink-50 px-2 py-1.5">
                <span className="font-medium text-ink-700">対象:</span> {TARGET_LABEL[activeTarget]}
              </div>
              <div className="rounded-md border border-ink-200 bg-ink-50 px-2 py-1.5">
                <span className="font-medium text-ink-700">チャット履歴:</span> {chat.length}件
              </div>
              <div className="rounded-md border border-ink-200 bg-ink-50 px-2 py-1.5">
                <span className="font-medium text-ink-700">比較履歴:</span> {comparisonEntryCount}件
              </div>
              <div className="rounded-md border border-ink-200 bg-ink-50 px-2 py-1.5">
                <span className="font-medium text-ink-700">ショートカット:</span> Enterで送信
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </WorkspaceShell>
  );
}

function EditorSection({
  title,
  onAdd,
  onFillExamples,
  canFillExamples = true,
  children,
}: {
  title: string;
  onAdd: () => void;
  onFillExamples?: () => void;
  canFillExamples?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-ink-100 bg-ink-50 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        <div className="flex items-center gap-1">
          {onFillExamples && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onFillExamples}
              disabled={!canFillExamples}
              title={
                canFillExamples
                  ? "空欄に入力例を補完します"
                  : "空欄がないため補完は不要です"
              }
            >
              例を補完
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onAdd}>
            + 追加
          </Button>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function EditorCard({
  title,
  onRemove,
  section,
  index,
  highlighted,
  children,
}: {
  title: string;
  onRemove: () => void;
  section: "priority" | "response" | "taboos" | "examples";
  index: number;
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-editor-section={section}
      data-editor-index={index}
      className={
        "scroll-mt-20 sm:scroll-mt-36 rounded-md border border-ink-200 bg-white p-3 transition " +
        (highlighted
          ? "ring-2 ring-signal-must/70 ring-offset-1"
          : "")
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-ink-600">{title}</span>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          削除
        </Button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium uppercase text-ink-500">{children}</p>;
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900 outline-none focus:border-accent focus:bg-accent/5 focus:ring-2 focus:ring-accent/20"
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900 outline-none focus:border-accent focus:bg-accent/5 focus:ring-2 focus:ring-accent/20"
    />
  );
}

function IntensitySelect({
  value,
  onChange,
}: {
  value: Intensity;
  onChange: (value: Intensity) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Intensity)}
      className="w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900 outline-none focus:border-accent focus:bg-accent/5 focus:ring-2 focus:ring-accent/20"
    >
      <option value="MUST">MUST（鉄則、必須）</option>
      <option value="SHOULD">SHOULD（原則、外すときは理由）</option>
      <option value="MAY">MAY（方針の目安、遵守は緩め）</option>
    </select>
  );
}

type CheckLevel = "critical" | "warning" | "info";
interface QualityCheck {
  id: string;
  level: CheckLevel;
  title: string;
  detail: string;
  targetSection?: "priority" | "response" | "taboos" | "examples";
  targetIndex?: number;
  recommendedAction?: string;
}

const CHECK_REASON_LABEL: Record<string, string> = {
  "must-empty": "理由: 安全性",
  "priority-gates-count": "理由: 判断の再現性",
  "priority-gate-fields": "理由: 条件の明確化",
  "taboos-duplicate": "理由: 曖昧性の回避",
  "response-duplicate": "理由: 曖昧性の回避",
  "weak-expression": "理由: 実行可能性",
  "examples-count": "理由: 挙動の再現性",
  "examples-incomplete": "理由: 教示の一貫性",
};

/** 先頭から見て、文が初めて重複したインデックス（2件目以降の方）。なければ -1 */
function findFirstDuplicateStatementIndex(rules: Rule[]): number {
  const seen = new Set<string>();
  for (let i = 0; i < rules.length; i++) {
    const key = rules[i].statement.trim().toLowerCase() || "__empty__";
    if (seen.has(key)) return i;
    seen.add(key);
  }
  return -1;
}

/** scenario / good / bad のいずれかが空の最初の Example。なければ -1 */
function findFirstIncompleteExampleIndex(examples: ExampleCase[]): number {
  for (let i = 0; i < examples.length; i++) {
    const e = examples[i];
    if (!e.scenario.trim() || !e.good.trim() || !e.bad.trim()) return i;
  }
  return -1;
}

/** When / Choose / Over / Rationale のいずれかが空の最初の Gate。なければ -1 */
function findFirstIncompleteGateIndex(gates: PriorityGate[]): number {
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    if (
      !g.when.trim() ||
      !g.choose.trim() ||
      !g.over.trim() ||
      !g.rationale.trim()
    ) {
      return i;
    }
  }
  return -1;
}

function findFirstEmptyRuleIndex(rules: Rule[]): number {
  return rules.findIndex((r) => !r.statement.trim());
}

function buildQualityChecks(ctx: ExecutableContext | null | undefined): QualityCheck[] {
  if (!ctx) return [];

  const checks: QualityCheck[] = [];
  const mustRules = [...ctx.responseProtocol.rules, ...ctx.taboos].filter(
    (r) => r.intensity === "MUST",
  );
  const emptyMust = mustRules.filter((r) => !r.statement.trim());
  const emptyMustResponseIndex = ctx.responseProtocol.rules.findIndex(
    (r) => r.intensity === "MUST" && !r.statement.trim(),
  );
  const emptyMustTabooIndex = ctx.taboos.findIndex(
    (r) => r.intensity === "MUST" && !r.statement.trim(),
  );
  const emptyMustTargetSection =
    emptyMustResponseIndex >= 0
      ? "response"
      : emptyMustTabooIndex >= 0
        ? "taboos"
        : undefined;
  const emptyMustTargetIndex =
    emptyMustResponseIndex >= 0
      ? emptyMustResponseIndex
      : emptyMustTabooIndex >= 0
        ? emptyMustTabooIndex
        : undefined;
  checks.push({
    id: "must-empty",
    level: emptyMust.length > 0 ? "critical" : "info",
    title:
      emptyMust.length > 0
        ? "MUSTルールに空欄があります"
        : "MUSTルールはすべて記述済みです",
    detail:
      emptyMust.length > 0
        ? `空欄 ${emptyMust.length} 件。MUSTは必ず具体文を入力してください。`
        : `${mustRules.length} 件のMUSTルールが記述されています。`,
    targetSection: emptyMust.length > 0 ? emptyMustTargetSection : undefined,
    targetIndex: emptyMust.length > 0 ? emptyMustTargetIndex : undefined,
    recommendedAction:
      emptyMust.length > 0
        ? emptyMustTargetSection === "taboos"
          ? `Taboo ${((emptyMustTabooIndex ?? 0) + 1).toString()} の文を具体化`
          : `Rule ${((emptyMustResponseIndex ?? 0) + 1).toString()} の文を具体化`
        : undefined,
  });

  checks.push({
    id: "priority-gates-count",
    level:
      ctx.priorityGates.length < 1
        ? "critical"
        : ctx.priorityGates.length < 3
          ? "warning"
          : "info",
    title:
      ctx.priorityGates.length < 1
        ? "Priority Gate がありません"
        : ctx.priorityGates.length < 3
          ? "Priority Gate が少なめです"
          : "Priority Gate 数は適切です",
    detail:
      ctx.priorityGates.length < 1
        ? "最低1件は必要です。実行型プロトコルの核心です。"
        : ctx.priorityGates.length < 3
          ? `${ctx.priorityGates.length} 件です。3件以上あると意思決定が安定します。`
          : `${ctx.priorityGates.length} 件設定されています。`,
    targetSection: ctx.priorityGates.length < 3 ? "priority" : undefined,
    // 件数が足りないときは「Gate を増やす」作業なので、Gate1 だけを強調しない（セクション全体へ）
    targetIndex: undefined,
    recommendedAction:
      ctx.priorityGates.length < 1
        ? "Priority Gateを1件以上追加"
        : ctx.priorityGates.length < 3
          ? "Gateを追加して3件以上にする"
          : undefined,
  });

  const incompleteGateIndex = findFirstIncompleteGateIndex(ctx.priorityGates);
  const hasIncompleteGate = incompleteGateIndex >= 0;
  checks.push({
    id: "priority-gate-fields",
    level: hasIncompleteGate ? "warning" : "info",
    title: hasIncompleteGate
      ? "Priority Gate に空欄があります"
      : "Priority Gate の各項目は入力済みです",
    detail: hasIncompleteGate
      ? "When / Choose / Over / Rationale はすべて埋めると判断ルールがブレません。"
      : "すべての Gate で4項目が記入されています。",
    targetSection: hasIncompleteGate ? "priority" : undefined,
    targetIndex: hasIncompleteGate ? incompleteGateIndex : undefined,
    recommendedAction: hasIncompleteGate
      ? `Gate ${incompleteGateIndex + 1} の空欄を埋める`
      : undefined,
  });

  const duplicateTabooCount =
    ctx.taboos.length -
    new Set(ctx.taboos.map((t) => t.statement.trim().toLowerCase())).size;
  const duplicateTabooIndex =
    duplicateTabooCount > 0 ? findFirstDuplicateStatementIndex(ctx.taboos) : -1;
  checks.push({
    id: "taboos-duplicate",
    level: duplicateTabooCount > 0 ? "warning" : "info",
    title:
      duplicateTabooCount > 0
        ? "Taboos に重複があります"
        : "Taboos の重複はありません",
    detail:
      duplicateTabooCount > 0
        ? `重複 ${duplicateTabooCount} 件。似た禁忌は統合すると読みやすくなります。`
        : `${ctx.taboos.length} 件の禁忌がユニークです。`,
    targetSection: duplicateTabooCount > 0 ? "taboos" : undefined,
    targetIndex: duplicateTabooIndex >= 0 ? duplicateTabooIndex : undefined,
    recommendedAction:
      duplicateTabooCount > 0 && duplicateTabooIndex >= 0
        ? `Taboo ${duplicateTabooIndex + 1} を統合・削除するか、文言を変えて区別する`
        : duplicateTabooCount > 0
          ? "重複するTabooを統合・削除"
          : undefined,
  });

  const duplicateResponseCount =
    ctx.responseProtocol.rules.length -
    new Set(
      ctx.responseProtocol.rules.map((r) => r.statement.trim().toLowerCase()),
    ).size;
  const duplicateResponseIndex =
    duplicateResponseCount > 0
      ? findFirstDuplicateStatementIndex(ctx.responseProtocol.rules)
      : -1;
  checks.push({
    id: "response-duplicate",
    level: duplicateResponseCount > 0 ? "warning" : "info",
    title:
      duplicateResponseCount > 0
        ? "Response Protocol に重複があります"
        : "Response Protocol の重複はありません",
    detail:
      duplicateResponseCount > 0
        ? `重複 ${duplicateResponseCount} 件。同じ表現が並ぶと優先度が曖昧になります。`
        : `${ctx.responseProtocol.rules.length} 件のルールがユニークです。`,
    targetSection: duplicateResponseCount > 0 ? "response" : undefined,
    targetIndex:
      duplicateResponseIndex >= 0 ? duplicateResponseIndex : undefined,
    recommendedAction:
      duplicateResponseCount > 0 && duplicateResponseIndex >= 0
        ? `Rule ${duplicateResponseIndex + 1} を統合するか、文言を変えて区別する`
        : duplicateResponseCount > 0
          ? "重複するルールを統合・削除"
          : undefined,
  });

  const weakExpressionPattern =
    /丁寧に|適切に|なるべく|いい感じ|必要に応じて|適宜|状況に応じて|できるだけ|できる限り/;
  const weakResponseIndex = ctx.responseProtocol.rules.findIndex((r) =>
    weakExpressionPattern.test(r.statement),
  );
  const weakTabooIndex = ctx.taboos.findIndex((r) =>
    weakExpressionPattern.test(r.statement),
  );
  const weakTargetSection =
    weakResponseIndex >= 0
      ? "response"
      : weakTabooIndex >= 0
        ? "taboos"
        : undefined;
  const weakTargetIndex =
    weakResponseIndex >= 0
      ? weakResponseIndex
      : weakTabooIndex >= 0
        ? weakTabooIndex
        : undefined;
  const weakRules = [...ctx.responseProtocol.rules, ...ctx.taboos].filter((r) =>
    weakExpressionPattern.test(r.statement),
  );
  checks.push({
    id: "weak-expression",
    level: weakRules.length > 0 ? "warning" : "info",
    title:
      weakRules.length > 0
        ? "抽象的な表現が含まれています"
        : "命令文は具体的です",
    detail:
      weakRules.length > 0
        ? `${weakRules.length} 件。観測可能な動作（例:「結論を1行目に書け」）へ置き換えると実行精度が上がります。`
        : "抽象語が少なく、実行指示として使いやすい状態です。",
    targetSection: weakRules.length > 0 ? weakTargetSection : undefined,
    targetIndex: weakRules.length > 0 ? weakTargetIndex : undefined,
    recommendedAction:
      weakRules.length > 0
        ? weakTargetSection === "taboos"
          ? `Taboo ${((weakTabooIndex >= 0 ? weakTabooIndex : 0) + 1).toString()} を具体命令に書き換え`
          : `Rule ${((weakResponseIndex >= 0 ? weakResponseIndex : 0) + 1).toString()} を具体命令に書き換え`
        : undefined,
  });

  checks.push({
    id: "examples-count",
    level: ctx.examples.length < 1 ? "warning" : "info",
    title:
      ctx.examples.length < 1
        ? "Examples が不足しています"
        : "Examples が設定されています",
    detail:
      ctx.examples.length < 1
        ? "最低1件の Good/Bad 対比があると、AIの再現性が上がります。音声・会話由来の文面のままで構いません（表現の重なりを個性として残してよい例です）。編集モードの Examples で追加できます。"
        : `${ctx.examples.length} 件の例があり、挙動の学習に有効です。会話調や似た言い回しがあっても教示用の例としてそのまま活かせます（ルールの重複チェックとは別です）。`,
    targetSection: ctx.examples.length < 1 ? "examples" : undefined,
    targetIndex: undefined,
    recommendedAction:
      ctx.examples.length < 1
        ? "Examples にシナリオと Good/Bad を1件追加する（編集モードの「+ 追加」）"
        : undefined,
  });

  if (ctx.examples.length >= 1) {
    const incompleteExampleIndex = findFirstIncompleteExampleIndex(ctx.examples);
    const hasIncompleteExample = incompleteExampleIndex >= 0;
    checks.push({
      id: "examples-incomplete",
      level: hasIncompleteExample ? "warning" : "info",
      title: hasIncompleteExample
        ? "Examples に未入力のフィールドがあります"
        : "Examples の各項目は入力済みです",
      detail: hasIncompleteExample
        ? `Example ${incompleteExampleIndex + 1} に、シナリオ・Good・Bad のいずれかが空です。教示用の対比としてそろえると効きます。`
        : "登録済みの例でシナリオ・Good・Bad がすべて埋まっています。",
      targetSection: hasIncompleteExample ? "examples" : undefined,
      targetIndex: hasIncompleteExample ? incompleteExampleIndex : undefined,
      recommendedAction: hasIncompleteExample
        ? `Example ${incompleteExampleIndex + 1} の空欄を埋める`
        : undefined,
    });
  }

  const levelOrder: Record<CheckLevel, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  checks.sort(
    (a, b) =>
      levelOrder[a.level] - levelOrder[b.level] || a.id.localeCompare(b.id),
  );

  return checks;
}

function StatusPill({ tone, label }: { tone: "critical" | "warning" | "ok"; label: string }) {
  const cls =
    tone === "critical"
      ? "border-signal-must/30 bg-signal-must/5 text-signal-must"
      : tone === "warning"
        ? "border-signal-should/30 bg-signal-should/5 text-signal-should"
        : "border-signal-may/30 bg-signal-may/5 text-signal-may";
  return <span className={`rounded-full border px-2 py-1 ${cls}`}>{label}</span>;
}

function sectionHighlightClass(
  active: boolean,
  tone: CheckLevel | null,
): string {
  if (!active) return "";
  if (tone === "critical") {
    return "rounded-lg ring-2 ring-signal-must/70 ring-offset-2 ring-offset-ink-50 transition";
  }
  if (tone === "warning") {
    return "rounded-lg ring-2 ring-signal-should/70 ring-offset-2 ring-offset-ink-50 transition";
  }
  return "rounded-lg ring-2 ring-signal-may/70 ring-offset-2 ring-offset-ink-50 transition";
}

function recommendTargetsFromTags(
  tags: string[],
): Array<{ target: ExportTarget; score: number; reason: string }> {
  const tieBreakerOrder: ExportTarget[] = [
    "gemini",
    "google_antigravity",
    "chatgpt",
    "claude_code",
    "claude",
    "cursor",
    "universal_agent",
  ];
  const lower = tags.map((t) => t.toLowerCase());
  const scoreMap = new Map<
    ExportTarget,
    { score: number; reasons: string[] }
  >();

  const addScore = (target: ExportTarget, score: number, reason: string) => {
    const prev = scoreMap.get(target);
    if (!prev) {
      scoreMap.set(target, { score, reasons: [reason] });
      return;
    }
    scoreMap.set(target, {
      score: prev.score + score,
      reasons: [...prev.reasons, reason],
    });
  };

  if (
    lower.some(
      (t) =>
        t === "default" ||
        t.includes("汎用") ||
        t.includes("general") ||
        t.includes("その他"),
    )
  ) {
    addScore("chatgpt", 50, "汎用・会話用途");
    addScore("universal_agent", 45, "ベンダー非依存用途");
    addScore("claude", 35, "文書・相談用途");
  }

  if (lower.some((t) => t.includes("claudecode") || t.includes("claude code"))) {
    addScore("claude_code", 100, "ClaudeCodeタグと一致");
    addScore("claude", 60, "Claude系モデルとの親和性");
  }
  if (lower.some((t) => t.includes("gemini"))) {
    addScore("gemini", 100, "Geminiタグと一致");
    addScore("google_antigravity", 65, "Google系モデルとの親和性");
  }
  if (lower.some((t) => t.includes("antigravity") || t.includes("google"))) {
    addScore("google_antigravity", 100, "Antigravity/Googleタグと一致");
    addScore("gemini", 60, "Gemini系モデルとの親和性");
  }
  if (lower.some((t) => t.includes("chatgpt") || t.includes("openai"))) {
    addScore("chatgpt", 100, "ChatGPT/OpenAIタグと一致");
    addScore("universal_agent", 55, "ベンダー横断の運用にも適合");
  }
  if (lower.some((t) => t.includes("youtube") || t.includes("動画"))) {
    addScore("universal_agent", 80, "動画・台本用途での汎用運用");
    addScore("chatgpt", 55, "コンテンツ下書き用途に強い");
  }
  if (lower.some((t) => t.includes("cursor") || t.includes("開発"))) {
    addScore("cursor", 90, "開発エージェント運用向け");
    addScore("claude_code", 50, "コード実装フローに適合");
  }

  // タグがあるが特定できないときは汎用候補を提案
  if (tags.length > 0 && scoreMap.size === 0) {
    addScore("chatgpt", 40, "汎用用途");
    addScore("universal_agent", 30, "ベンダー非依存用途");
  }
  // タグ未設定でも比較・おすすめが使えるよう最低2件
  if (scoreMap.size < 2) {
    addScore("chatgpt", 30, "デフォルト候補");
    addScore("universal_agent", 25, "デフォルト候補");
  }

  return Array.from(scoreMap.entries())
    .sort((a, b) => {
      const scoreDiff = b[1].score - a[1].score;
      if (scoreDiff !== 0) return scoreDiff;
      return tieBreakerOrder.indexOf(a[0]) - tieBreakerOrder.indexOf(b[0]);
    })
    .map(([target, value]) => ({
      target,
      score: value.score,
      reason: value.reasons[0],
    }));
}

