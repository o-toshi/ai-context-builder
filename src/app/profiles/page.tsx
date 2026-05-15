"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useBuilderStore } from "@/store/builder-store";
import { Button, buttonClassName } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ProfilesPage() {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"updated_desc" | "updated_asc" | "name_asc" | "name_desc">(
    "updated_desc",
  );
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [renamingProfileId, setRenamingProfileId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [editingTagsProfileId, setEditingTagsProfileId] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [duplicatingProfileId, setDuplicatingProfileId] = useState<string | null>(null);
  const [duplicateNameInput, setDuplicateNameInput] = useState("");
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [creatingInline, setCreatingInline] = useState(false);
  const [createNameInput, setCreateNameInput] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const duplicateInputRef = useRef<HTMLInputElement | null>(null);
  const tagsTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const profiles = useBuilderStore((s) => s.profiles);
  const currentProfileId = useBuilderStore((s) => s.currentProfileId);
  const switchProfile = useBuilderStore((s) => s.switchProfile);
  const createProfile = useBuilderStore((s) => s.createProfile);
  const duplicateCurrentProfile = useBuilderStore((s) => s.duplicateCurrentProfile);
  const renameProfile = useBuilderStore((s) => s.renameProfile);
  const setProfileTags = useBuilderStore((s) => s.setProfileTags);
  const deleteProfile = useBuilderStore((s) => s.deleteProfile);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreate = () => {
    closeInlineEditors();
    setCreatingInline(true);
    setCreateNameInput("新しいプロファイル");
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 1800);
  };

  useEffect(() => {
    if (creatingInline) createInputRef.current?.focus();
  }, [creatingInline]);

  useEffect(() => {
    if (renamingProfileId) renameInputRef.current?.focus();
  }, [renamingProfileId]);

  useEffect(() => {
    if (duplicatingProfileId) duplicateInputRef.current?.focus();
  }, [duplicatingProfileId]);

  useEffect(() => {
    if (editingTagsProfileId) tagsTextareaRef.current?.focus();
  }, [editingTagsProfileId]);

  const closeInlineEditors = () => {
    setRenamingProfileId(null);
    setRenameInput("");
    setEditingTagsProfileId(null);
    setTagsInput("");
    setDuplicatingProfileId(null);
    setDuplicateNameInput("");
    setDeletingProfileId(null);
    setCreatingInline(false);
    setCreateNameInput("");
  };

  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    for (const p of profiles) {
      for (const t of p.tags) {
        if (t.trim()) tags.add(t.trim());
      }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b, "ja"));
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return profiles
      .filter((p) => {
        const matchQuery =
          normalizedQuery.length === 0 ||
          p.name.toLowerCase().includes(normalizedQuery) ||
          p.tags.some((t) => t.toLowerCase().includes(normalizedQuery));
        const matchTag = tagFilter === "all" || p.tags.includes(tagFilter);
        return matchQuery && matchTag;
      })
      .sort((a, b) => {
        if (sortBy === "updated_desc") {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        if (sortBy === "updated_asc") {
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        }
        if (sortBy === "name_desc") {
          return b.name.localeCompare(a.name, "ja");
        }
        return a.name.localeCompare(b.name, "ja");
      });
  }, [profiles, query, sortBy, tagFilter]);

  return (
    <main className="min-h-screen bg-ink-50">
      {!mounted ? (
        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <h1 className="text-2xl font-semibold tracking-tightish text-ink-900">
            プロファイル管理
          </h1>
          <p className="mt-2 text-sm text-ink-500">読み込み中...</p>
        </div>
      ) : (
        <>
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tightish text-ink-900">
              プロファイル管理
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              用途ごとにコンテキストを分けて管理できます。
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleCreate}
              className="whitespace-nowrap"
            >
              ＋新規作成
            </Button>
            <Link
              href="/help/glossary"
              className={buttonClassName({
                variant: "ghost",
                className: "whitespace-nowrap",
              })}
            >
              用語ヘルプ
            </Link>
            <Link
              href="/result"
              className={buttonClassName({ className: "whitespace-nowrap" })}
            >
              結果画面へ戻る
            </Link>
          </div>
          {creatingInline && (
            <div className="mt-3 max-w-md rounded-md border border-ink-300 bg-ink-100/70 p-3 ring-1 ring-ink-200">
              <p className="mb-2 text-xs font-medium text-ink-700">新しいプロファイル名</p>
              <input
                ref={createInputRef}
                value={createNameInput}
                onChange={(e) => setCreateNameInput(e.target.value)}
                placeholder="新しいプロファイル"
                className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm outline-none focus:border-ink-900"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setCreatingInline(false);
                    setCreateNameInput("");
                    return;
                  }
                  if (e.key === "Enter" && createNameInput.trim().length > 0) {
                    createProfile(createNameInput);
                    setCreatingInline(false);
                    setCreateNameInput("");
                    showToast("新しいプロファイルを作成しました。");
                  }
                }}
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setCreatingInline(false);
                    setCreateNameInput("");
                  }}
                >
                  キャンセル
                </Button>
                <Button
                  size="sm"
                  disabled={createNameInput.trim().length === 0}
                  onClick={() => {
                    createProfile(createNameInput);
                    setCreatingInline(false);
                    setCreateNameInput("");
                    showToast("新しいプロファイルを作成しました。");
                  }}
                >
                  作成する
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-ink-500">Enterで保存 / Escでキャンセル</p>
            </div>
          )}
        </div>

        <div className="mb-4 grid gap-2 rounded-lg border border-ink-100 bg-white p-3 md:grid-cols-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名前・タグで検索"
            className="h-9 rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-800 outline-none focus:border-ink-900"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-9 rounded-md border border-ink-200 bg-white px-2 text-sm text-ink-800 outline-none focus:border-ink-900"
          >
            <option value="updated_desc">更新日（新しい順）</option>
            <option value="updated_asc">更新日（古い順）</option>
            <option value="name_asc">名前（A→Z）</option>
            <option value="name_desc">名前（Z→A）</option>
          </select>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="h-9 rounded-md border border-ink-200 bg-white px-2 text-sm text-ink-800 outline-none focus:border-ink-900"
          >
            <option value="all">タグ: すべて</option>
            {tagOptions.map((tag) => (
              <option key={tag} value={tag}>
                タグ: {tag}
              </option>
            ))}
          </select>
        </div>

        <p className="mb-3 text-xs text-ink-500">
          表示件数: {filteredProfiles.length} / {profiles.length}
        </p>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProfiles.map((p) => {
            const active = p.id === currentProfileId;
            return (
              <Card key={p.id} className={active ? "border-ink-900" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>{p.name}</CardTitle>
                      <CardDescription>
                        更新: {new Date(p.updatedAt).toLocaleString("ja-JP")}
                      </CardDescription>
                    </div>
                    {active && (
                      <span className="rounded-full bg-ink-900 px-2 py-0.5 text-[11px] text-white">
                        使用中
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-xs text-ink-500">
                    タグ: {p.tags.join(" / ") || "タグなし"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {!active && (
                      <Button size="sm" variant="secondary" onClick={() => switchProfile(p.id)}>
                        このプロファイルに切替
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        closeInlineEditors();
                        setRenamingProfileId(p.id);
                        setRenameInput(p.name);
                      }}
                    >
                      名前変更
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        closeInlineEditors();
                        setEditingTagsProfileId(p.id);
                        setTagsInput(p.tags.join(", "));
                      }}
                    >
                      タグ編集
                    </Button>
                    {active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          closeInlineEditors();
                          setDuplicatingProfileId(p.id);
                          setDuplicateNameInput(`${p.name} (コピー)`);
                        }}
                      >
                        複製
                      </Button>
                    )}
                    {!active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          closeInlineEditors();
                          setDeletingProfileId(p.id);
                        }}
                      >
                        削除
                      </Button>
                    )}
                  </div>
                  {renamingProfileId === p.id && (
                    <div className="mt-3 rounded-md border border-ink-300 bg-ink-100/70 p-3 ring-1 ring-ink-200">
                      <p className="mb-2 text-xs font-medium text-ink-700">プロファイル名を変更</p>
                      <input
                        ref={renameInputRef}
                        value={renameInput}
                        onChange={(e) => setRenameInput(e.target.value)}
                        placeholder="新しい名前"
                        className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm outline-none focus:border-ink-900"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setRenamingProfileId(null);
                            setRenameInput("");
                            return;
                          }
                          if (e.key === "Enter" && renameInput.trim().length > 0) {
                            renameProfile(p.id, renameInput);
                            setRenamingProfileId(null);
                            setRenameInput("");
                            showToast("プロファイル名を保存しました。");
                          }
                        }}
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setRenamingProfileId(null);
                            setRenameInput("");
                          }}
                        >
                          キャンセル
                        </Button>
                        <Button
                          size="sm"
                          disabled={renameInput.trim().length === 0}
                          onClick={() => {
                            renameProfile(p.id, renameInput);
                            setRenamingProfileId(null);
                            setRenameInput("");
                            showToast("プロファイル名を保存しました。");
                          }}
                        >
                          保存して反映
                        </Button>
                      </div>
                      <p className="mt-2 text-[11px] text-ink-500">
                        Enterで保存 / Escでキャンセル
                      </p>
                    </div>
                  )}
                  {duplicatingProfileId === p.id && (
                    <div className="mt-3 rounded-md border border-ink-300 bg-ink-100/70 p-3 ring-1 ring-ink-200">
                      <p className="mb-2 text-xs font-medium text-ink-700">
                        複製プロファイル名を入力
                      </p>
                      <input
                        ref={duplicateInputRef}
                        value={duplicateNameInput}
                        onChange={(e) => setDuplicateNameInput(e.target.value)}
                        placeholder="コピー先の名前"
                        className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm outline-none focus:border-ink-900"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setDuplicatingProfileId(null);
                            setDuplicateNameInput("");
                            return;
                          }
                          if (e.key === "Enter" && duplicateNameInput.trim().length > 0) {
                            duplicateCurrentProfile(duplicateNameInput);
                            setDuplicatingProfileId(null);
                            setDuplicateNameInput("");
                            showToast("プロファイルを複製しました。");
                          }
                        }}
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setDuplicatingProfileId(null);
                            setDuplicateNameInput("");
                          }}
                        >
                          キャンセル
                        </Button>
                        <Button
                          size="sm"
                          disabled={duplicateNameInput.trim().length === 0}
                          onClick={() => {
                            duplicateCurrentProfile(duplicateNameInput);
                            setDuplicatingProfileId(null);
                            setDuplicateNameInput("");
                            showToast("プロファイルを複製しました。");
                          }}
                        >
                          複製を作成
                        </Button>
                      </div>
                      <p className="mt-2 text-[11px] text-ink-500">
                        Enterで保存 / Escでキャンセル
                      </p>
                    </div>
                  )}
                  {editingTagsProfileId === p.id && (
                    <div className="mt-3 rounded-md border border-ink-300 bg-ink-100/70 p-3 ring-1 ring-ink-200">
                      <p className="mb-2 text-xs font-medium text-ink-700">
                        タグ編集（カンマ区切り）
                      </p>
                      <textarea
                        ref={tagsTextareaRef}
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="例: ClaudeCode, Antigravity, YouTube"
                        className="min-h-20 w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-ink-900"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setEditingTagsProfileId(null);
                            setTagsInput("");
                            return;
                          }
                          if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && tagsInput.trim().length > 0) {
                            setProfileTags(
                              p.id,
                              tagsInput
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean),
                            );
                            setEditingTagsProfileId(null);
                            setTagsInput("");
                            showToast("タグを保存しました。");
                          }
                        }}
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingTagsProfileId(null);
                            setTagsInput("");
                          }}
                        >
                          キャンセル
                        </Button>
                        <Button
                          size="sm"
                          disabled={tagsInput.trim().length === 0}
                          onClick={() => {
                            setProfileTags(
                              p.id,
                              tagsInput
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean),
                            );
                            setEditingTagsProfileId(null);
                            setTagsInput("");
                            showToast("タグを保存しました。");
                          }}
                        >
                          保存して反映
                        </Button>
                      </div>
                      <p className="mt-2 text-[11px] text-ink-500">
                        Ctrl/Cmd + Enterで保存 / Escでキャンセル
                      </p>
                    </div>
                  )}
                  {deletingProfileId === p.id && (
                    <div className="mt-3 rounded-md border border-signal-must/30 bg-signal-must/5 p-3">
                      <p className="mb-2 text-xs font-medium text-signal-must">
                        「{p.name}」を削除しますか？
                      </p>
                      <p className="text-xs text-ink-600">
                        このプロファイルの入力内容が削除されます。必要なら先にバックアップしてください。
                      </p>
                      <div className="mt-2 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setDeletingProfileId(null)}
                        >
                          キャンセル
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            const result = deleteProfile(p.id);
                            if (!result.ok) {
                              window.alert(result.error);
                            } else {
                              showToast("プロファイルを削除しました。");
                            }
                            setDeletingProfileId(null);
                          }}
                        >
                          削除を実行
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {filteredProfiles.length === 0 && (
            <Card className="md:col-span-2 xl:col-span-3">
              <CardContent>
                <p className="py-4 text-sm text-ink-500">
                  条件に一致するプロファイルがありません。検索語かタグ条件を変更してください。
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-[60] rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 shadow-lab">
          {toastMessage}
        </div>
      )}
        </>
      )}
    </main>
  );
}

