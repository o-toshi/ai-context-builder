"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import type { StepId } from "@/types/builder";
import { Button, buttonClassName } from "@/components/ui/button";
import { useBuilderStore } from "@/store/builder-store";

type BackupPreview = {
  exportedAt?: string;
  role?: string;
  industry?: string;
  teamSize?: string;
  personalityCount: number;
  interviewCount: number;
  scenarioCount: number;
  hasContext: boolean;
  exportCount: number;
  priorityGateCount: number;
  responseRuleCount: number;
  tabooCount: number;
  exampleCount: number;
};

function parseBackupPreview(json: string): BackupPreview | null {
  try {
    const parsed = JSON.parse(json) as {
      schemaVersion?: string;
      exportedAt?: string;
      currentProfileId?: string;
      data?: {
        currentProfileId?: string;
        profiles?: Array<{ id: string }>;
        profileStates?: Record<
          string,
          {
            input?: {
              profile?: {
                role?: string;
                industry?: string;
                teamSize?: string;
              };
              personalityAnswers?: unknown[];
              interviewClips?: unknown[];
              scenarioAnswers?: unknown[];
            };
            context?: unknown;
            exports?: Record<string, string>;
          }
        >;
        input?: {
          profile?: {
            role?: string;
            industry?: string;
            teamSize?: string;
          };
          personalityAnswers?: unknown[];
          interviewClips?: unknown[];
          scenarioAnswers?: unknown[];
        };
        context?: unknown;
        exports?: Record<string, string>;
      };
    };

    if (!parsed.schemaVersion || !parsed.data) {
      return null;
    }
    if (parsed.schemaVersion === "backup-v2") {
      const currentId = parsed.data.currentProfileId;
      const stateCandidate =
        (currentId && parsed.data.profileStates?.[currentId]) ??
        (parsed.data.profiles?.[0]?.id
          ? parsed.data.profileStates?.[parsed.data.profiles[0].id]
          : undefined);
      const state =
        typeof stateCandidate === "object" && stateCandidate !== null
          ? stateCandidate
          : undefined;
      const input = state?.input;
      if (!input) return null;
      return {
        exportedAt: parsed.exportedAt,
        role: input.profile?.role,
        industry: input.profile?.industry,
        teamSize: input.profile?.teamSize,
        personalityCount: input.personalityAnswers?.length ?? 0,
        interviewCount: input.interviewClips?.length ?? 0,
        scenarioCount: input.scenarioAnswers?.length ?? 0,
        hasContext: Boolean(state?.context),
        exportCount: Object.keys(state?.exports ?? {}).length,
        priorityGateCount:
          (state?.context as { priorityGates?: unknown[] } | undefined)?.priorityGates
            ?.length ?? 0,
        responseRuleCount:
          (
            state?.context as
              | { responseProtocol?: { rules?: unknown[] } }
              | undefined
          )?.responseProtocol?.rules?.length ?? 0,
        tabooCount:
          (state?.context as { taboos?: unknown[] } | undefined)?.taboos?.length ?? 0,
        exampleCount:
          (state?.context as { examples?: unknown[] } | undefined)?.examples?.length ?? 0,
      };
    }
    if (parsed.schemaVersion !== "backup-v1" || !parsed.data.input) {
      return null;
    }

    return {
      exportedAt: parsed.exportedAt,
      role: parsed.data.input.profile?.role,
      industry: parsed.data.input.profile?.industry,
      teamSize: parsed.data.input.profile?.teamSize,
      personalityCount: parsed.data.input.personalityAnswers?.length ?? 0,
      interviewCount: parsed.data.input.interviewClips?.length ?? 0,
      scenarioCount: parsed.data.input.scenarioAnswers?.length ?? 0,
      hasContext: Boolean(parsed.data.context),
      exportCount: Object.keys(parsed.data.exports ?? {}).length,
      priorityGateCount:
        (parsed.data.context as { priorityGates?: unknown[] } | undefined)
          ?.priorityGates?.length ?? 0,
      responseRuleCount:
        (
          parsed.data.context as
            | { responseProtocol?: { rules?: unknown[] } }
            | undefined
        )?.responseProtocol?.rules?.length ?? 0,
      tabooCount:
        (parsed.data.context as { taboos?: unknown[] } | undefined)?.taboos
          ?.length ?? 0,
      exampleCount:
        (parsed.data.context as { examples?: unknown[] } | undefined)
          ?.examples?.length ?? 0,
    };
  } catch {
    return null;
  }
}

interface WorkspaceShellProps {
  /** 呼び出し側の互換用（ステッパー廃止後は未使用） */
  current?: StepId;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * 診断ウィザードの共通シェル。
 * 固定ヘッダーは使わず、本文先頭のリンクと「プロファイル・データ」メニューで補助操作を提供。
 */
export function WorkspaceShell({
  title,
  subtitle,
  children,
}: WorkspaceShellProps) {
  const reset = useBuilderStore((s) => s.reset);
  const exportBackup = useBuilderStore((s) => s.exportBackup);
  const importBackup = useBuilderStore((s) => s.importBackup);
  const profiles = useBuilderStore((s) => s.profiles);
  const currentProfileId = useBuilderStore((s) => s.currentProfileId);
  const switchProfile = useBuilderStore((s) => s.switchProfile);
  const createProfile = useBuilderStore((s) => s.createProfile);
  const duplicateCurrentProfile = useBuilderStore((s) => s.duplicateCurrentProfile);
  const renameProfile = useBuilderStore((s) => s.renameProfile);
  const setProfileTags = useBuilderStore((s) => s.setProfileTags);
  const deleteProfile = useBuilderStore((s) => s.deleteProfile);
  const currentPersonalityCount = useBuilderStore(
    (s) => s.input.personalityAnswers.length,
  );
  const currentInterviewCount = useBuilderStore(
    (s) => s.input.interviewClips.length,
  );
  const currentScenarioCount = useBuilderStore(
    (s) => s.input.scenarioAnswers.length,
  );
  const currentHasContext = useBuilderStore((s) => Boolean(s.context));
  const currentExportCount = useBuilderStore(
    (s) => Object.keys(s.exports ?? {}).length,
  );
  const currentPriorityGateCount = useBuilderStore(
    (s) => s.context?.priorityGates.length ?? 0,
  );
  const currentResponseRuleCount = useBuilderStore(
    (s) => s.context?.responseProtocol.rules.length ?? 0,
  );
  const currentTabooCount = useBuilderStore((s) => s.context?.taboos.length ?? 0);
  const currentExampleCount = useBuilderStore(
    (s) => s.context?.examples.length ?? 0,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingImportJson, setPendingImportJson] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<BackupPreview | null>(null);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [tagsModalOpen, setTagsModalOpen] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [importSuccessSummary, setImportSuccessSummary] = useState<BackupPreview | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const tagSuggestions = useMemo(() => {
    const base = ["ClaudeCode", "Cursor", "Gemini", "ChatGPT", "Antigravity", "YouTube"];
    const all = new Set<string>(base);
    for (const p of profiles) {
      for (const t of p.tags) {
        const normalized = t.trim();
        if (normalized) all.add(normalized);
      }
    }
    return Array.from(all).slice(0, 16);
  }, [profiles]);

  const handleBackupExport = () => {
    const json = exportBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-context-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const handleFinalSnapshotSave = () => {
    const json = exportBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-context-final-snapshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("完成版スナップショットを保存しました。");
  };

  const handleBackupImportClick = () => {
    fileInputRef.current?.click();
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 1800);
  };

  const handleCreateProfile = () => {
    const name = window.prompt("新しいプロファイル名を入力してください", "新しいプロファイル");
    if (name === null) return;
    createProfile(name);
    showToast("新しいプロファイルを作成しました。");
  };

  const handleDuplicateProfile = () => {
    const currentName =
      profiles.find((p) => p.id === currentProfileId)?.name ?? "プロファイル";
    const name = window.prompt(
      "複製プロファイル名を入力してください",
      `${currentName} (コピー)`,
    );
    if (name === null) return;
    duplicateCurrentProfile(name);
    showToast("プロファイルを複製しました。");
  };

  const handleRenameProfile = () => {
    const currentName =
      profiles.find((p) => p.id === currentProfileId)?.name ?? "プロファイル";
    setRenameInput(currentName);
    setRenameModalOpen(true);
  };

  const handleDeleteProfile = () => {
    const currentName =
      profiles.find((p) => p.id === currentProfileId)?.name ?? "プロファイル";
    const confirmed = window.confirm(
      `「${currentName}」を削除しますか？\nこのプロファイルの入力内容も削除されます。`,
    );
    if (!confirmed) return;
    const result = deleteProfile(currentProfileId);
    if (!result.ok) {
      window.alert(result.error);
    } else {
      showToast("プロファイルを削除しました。");
    }
  };

  const handleEditTags = () => {
    const current = profiles.find((p) => p.id === currentProfileId);
    setTagsInput((current?.tags ?? []).join(", "));
    setTagsModalOpen(true);
  };

  const handleBackupImportChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const preview = parseBackupPreview(text);
    if (!preview) {
      window.alert(
        "バックアップ形式が不正です。ai-context-builder のエクスポートJSONを選択してください。",
      );
      e.target.value = "";
      return;
    }
    setPendingImportJson(text);
    setPendingPreview(preview);
    e.target.value = "";
  };

  const closeImportPreview = () => {
    setPendingImportJson(null);
    setPendingPreview(null);
  };

  const confirmImport = () => {
    if (!pendingImportJson) return;
    const result = importBackup(pendingImportJson);
    if (!result.ok) {
      window.alert(result.error);
    } else {
      setImportSuccessSummary(pendingPreview);
      showToast("バックアップを復元しました。");
    }
    closeImportPreview();
  };

  const deltaText = (nextValue: number, currentValue: number): string => {
    const diff = nextValue - currentValue;
    if (diff > 0) return `（+${diff}）`;
    if (diff < 0) return `（${diff}）`;
    return "（±0）";
  };

  return (
    <div className="min-h-screen bg-ink-50">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleBackupImportChange}
      />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-10">
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-600">
          <Link
            href="/"
            className="font-medium text-ink-800 underline-offset-2 hover:text-ink-900 hover:underline"
          >
            トップ
          </Link>
          <Link
            href="/help/glossary"
            className="underline-offset-2 hover:text-ink-900 hover:underline"
          >
            用語ヘルプ
          </Link>
          <details className="group relative">
            <summary className="cursor-pointer list-none underline-offset-2 marker:content-none hover:text-ink-900 hover:underline [&::-webkit-details-marker]:hidden">
              プロファイル・データ
            </summary>
            <div className="absolute left-0 top-full z-30 mt-2 w-[min(100vw-2rem,22rem)] rounded-lg border border-ink-200 bg-white p-3 shadow-lab">
              <label className="text-xs text-ink-500">現在のプロファイル</label>
              <select
                value={currentProfileId}
                onChange={(e) => switchProfile(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm text-ink-800 outline-none focus:border-ink-900"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 truncate text-[11px] text-ink-500">
                タグ:{" "}
                {(profiles.find((p) => p.id === currentProfileId)?.tags ?? []).join(
                  " / ",
                ) || "なし"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setProfilePanelOpen(true)}
                >
                  管理
                </Button>
                <Button size="sm" variant="ghost" onClick={handleEditTags}>
                  タグ編集
                </Button>
              </div>
              <div className="mt-3 flex flex-col gap-1 border-t border-ink-100 pt-3">
                <Button size="sm" variant="ghost" onClick={handleBackupExport}>
                  バックアップ保存
                </Button>
                <Button size="sm" variant="ghost" onClick={handleFinalSnapshotSave}>
                  完成版を保存
                </Button>
                <Button size="sm" variant="ghost" onClick={handleBackupImportClick}>
                  バックアップ復元
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (
                      window.confirm(
                        "すべての回答をリセットします。よろしいですか？",
                      )
                    ) {
                      reset();
                    }
                  }}
                >
                  すべてリセット
                </Button>
              </div>
            </div>
          </details>
        </div>
        {importSuccessSummary && (
          <div className="mb-5 rounded-lg border border-signal-may/35 bg-signal-may/10 px-4 py-3 text-sm text-ink-800">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-ink-900">
                復元が完了しました（内容サマリー）
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setImportSuccessSummary(null)}
              >
                閉じる
              </Button>
            </div>
            <p className="mt-1 text-xs text-ink-600">
              性格 {importSuccessSummary.personalityCount}件 / インタビュー{" "}
              {importSuccessSummary.interviewCount}件 / シナリオ{" "}
              {importSuccessSummary.scenarioCount}件 / Priority Gate{" "}
              {importSuccessSummary.priorityGateCount}件 / Response{" "}
              {importSuccessSummary.responseRuleCount}件 / Taboos{" "}
              {importSuccessSummary.tabooCount}件 / Examples{" "}
              {importSuccessSummary.exampleCount}件
            </p>
          </div>
        )}
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tightish text-ink-900 md:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-base leading-relaxed text-ink-600">
              {subtitle}
            </p>
          )}
        </div>
        <div className="mt-8">{children}</div>
      </main>

      {pendingPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 px-4">
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl border border-ink-200 bg-white p-5 shadow-lab">
            <h3 className="text-lg font-semibold tracking-tightish text-ink-900">
              バックアップ復元の確認
            </h3>
            <p className="mt-2 text-sm text-ink-600">
              復元を実行すると、現在のデータはバックアップ内容で上書きされます。
            </p>
            <div className="mt-3 rounded-lg border border-signal-must/25 bg-signal-must/5 px-3 py-2 text-xs leading-relaxed text-signal-must">
              <p className="font-medium">この操作は取り消せません。</p>
              <p className="mt-1">
                上書きされる対象: プロフィール入力 / 性格回答 / インタビュー回答 / シナリオ回答 / 生成コンテキスト / エクスポート済み Markdown
              </p>
            </div>
            <div className="mt-4 rounded-lg border border-ink-100 bg-ink-50 p-3 text-sm text-ink-700">
              <ul className="space-y-1">
                <li>
                  保存日時:{" "}
                  {pendingPreview.exportedAt
                    ? new Date(pendingPreview.exportedAt).toLocaleString("ja-JP")
                    : "不明"}
                </li>
                <li>
                  プロフィール: {pendingPreview.role ?? "-"} /{" "}
                  {pendingPreview.industry ?? "-"} /{" "}
                  {pendingPreview.teamSize ?? "-"}
                </li>
                <li>性格回答: {pendingPreview.personalityCount}件</li>
                <li>
                  インタビュー回答: {pendingPreview.interviewCount}件
                </li>
                <li>
                  シナリオ回答: {pendingPreview.scenarioCount}件
                </li>
                <li>
                  生成コンテキスト: {pendingPreview.hasContext ? "あり" : "なし"}
                </li>
                <li>エクスポート済みMarkdown: {pendingPreview.exportCount}件</li>
                <li>Priority Gate: {pendingPreview.priorityGateCount}件</li>
                <li>Response Protocolルール: {pendingPreview.responseRuleCount}件</li>
                <li>Taboos: {pendingPreview.tabooCount}件</li>
                <li>Examples: {pendingPreview.exampleCount}件</li>
              </ul>
            </div>
            <div className="mt-3 rounded-lg border border-ink-100 bg-white p-3 text-xs text-ink-600">
              <p className="mb-1 font-medium text-ink-700">現在データとの差分</p>
              <ul className="space-y-1">
                <li>
                  性格回答:{" "}
                  {deltaText(
                    pendingPreview.personalityCount,
                    currentPersonalityCount,
                  )}
                </li>
                <li>
                  インタビュー回答:{" "}
                  {deltaText(
                    pendingPreview.interviewCount,
                    currentInterviewCount,
                  )}
                </li>
                <li>
                  シナリオ回答:{" "}
                  {deltaText(
                    pendingPreview.scenarioCount,
                    currentScenarioCount,
                  )}
                </li>
                <li>
                  生成コンテキスト:{" "}
                  {pendingPreview.hasContext === currentHasContext
                    ? "変更なし"
                    : pendingPreview.hasContext
                      ? "なし → あり"
                      : "あり → なし"}
                </li>
                <li>
                  エクスポート済みMarkdown:{" "}
                  {deltaText(
                    pendingPreview.exportCount,
                    currentExportCount,
                  )}
                </li>
                <li>
                  Priority Gate:{" "}
                  {deltaText(
                    pendingPreview.priorityGateCount,
                    currentPriorityGateCount,
                  )}
                </li>
                <li>
                  Response Protocolルール:{" "}
                  {deltaText(
                    pendingPreview.responseRuleCount,
                    currentResponseRuleCount,
                  )}
                </li>
                <li>
                  Taboos:{" "}
                  {deltaText(
                    pendingPreview.tabooCount,
                    currentTabooCount,
                  )}
                </li>
                <li>
                  Examples:{" "}
                  {deltaText(
                    pendingPreview.exampleCount,
                    currentExampleCount,
                  )}
                </li>
              </ul>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={handleBackupExport}>
                いまの状態を先に保存
              </Button>
              <Button variant="secondary" onClick={closeImportPreview}>
                キャンセル
              </Button>
              <Button variant="primary" onClick={confirmImport}>
                上書きして復元する
              </Button>
            </div>
          </div>
        </div>
      )}
      {profilePanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 px-4">
          <div className="w-full max-w-md rounded-xl border border-ink-200 bg-white p-5 shadow-lab">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold tracking-tightish text-ink-900">
                プロファイル管理
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setProfilePanelOpen(false)}
              >
                閉じる
              </Button>
            </div>
            <p className="mt-2 text-sm text-ink-600">
              通常はこの画面で編集を進め、必要なときだけプロファイル設定を操作します。
            </p>
            <div className="mt-4 rounded-md border border-ink-200 bg-ink-50 p-3">
              <label className="text-xs text-ink-500">現在のプロファイル</label>
              <select
                value={currentProfileId}
                onChange={(e) => switchProfile(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm text-ink-800 outline-none focus:border-ink-900"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={handleCreateProfile}>
                新規作成
              </Button>
              <Button size="sm" variant="secondary" onClick={handleDuplicateProfile}>
                複製
              </Button>
              <Button size="sm" variant="ghost" onClick={handleRenameProfile}>
                名前変更
              </Button>
              <Button size="sm" variant="ghost" onClick={handleEditTags}>
                タグ編集
              </Button>
              <Button size="sm" variant="danger" onClick={handleDeleteProfile}>
                削除
              </Button>
            </div>
            <div className="mt-4 border-t border-ink-100 pt-3">
              <Link
                href="/profiles"
                className={buttonClassName({ variant: "ghost", size: "sm" })}
              >
                詳細管理画面を開く
              </Link>
            </div>
          </div>
        </div>
      )}
      {renameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 px-4">
          <div className="w-full max-w-md rounded-xl border border-ink-200 bg-white p-5 shadow-lab">
            <h3 className="text-lg font-semibold tracking-tightish text-ink-900">
              プロファイル名を変更
            </h3>
            <input
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="新しい名前"
              className="mt-3 h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-800 outline-none focus:border-ink-900"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setRenameModalOpen(false);
                  setRenameInput("");
                }}
              >
                キャンセル
              </Button>
              <Button
                onClick={() => {
                  renameProfile(currentProfileId, renameInput);
                  setRenameModalOpen(false);
                  setRenameInput("");
                  showToast("プロファイル名を保存しました。");
                }}
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
      {tagsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 px-4">
          <div className="w-full max-w-md rounded-xl border border-ink-200 bg-white p-5 shadow-lab">
            <h3 className="text-lg font-semibold tracking-tightish text-ink-900">
              タグ編集
            </h3>
            <textarea
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="例: ClaudeCode, Antigravity, YouTube"
              className="mt-3 min-h-24 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-900"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tagSuggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="rounded-full border border-ink-200 px-2 py-0.5 text-[11px] text-ink-600 hover:bg-ink-50"
                  onClick={() => {
                    const current = tagsInput
                      .split(",")
                      .map((t) => t.trim())
                      .filter((t) => t.length > 0);
                    if (current.includes(tag)) return;
                    setTagsInput([...current, tag].join(", "));
                  }}
                >
                  + {tag}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-500">カンマ区切りで入力してください</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setTagsModalOpen(false);
                  setTagsInput("");
                }}
              >
                キャンセル
              </Button>
              <Button
                onClick={() => {
                  setProfileTags(
                    currentProfileId,
                    tagsInput
                      .split(",")
                      .map((t) => t.trim())
                      .filter((t) => t.length > 0),
                  );
                  setTagsModalOpen(false);
                  setTagsInput("");
                  showToast("タグを保存しました。");
                }}
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-[60] rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 shadow-lab">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
