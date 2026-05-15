"use client";

/**
 * Builder Store
 *
 * 全ステップの入力値・進捗・生成結果を保持する Zustand store。
 * MVP ではログイン不要なので、永続化は localStorage のみ。
 *
 * 永続化キー: "ai-context-builder:v1"
 *
 * 重要な設計判断:
 *   - 中間 JSON (ExecutableContext) を編集できる必要があるため、
 *     `setContext` と `patchContext` を分けて持つ。
 *   - 音声 (Blob) は base64 化して JSON 化可能にしている。
 *     localStorage 容量（~5MB）を超えそうなら、後で IndexedDB に逃がす。
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  BuilderState,
  InterviewClip,
  PersonalityAnswer,
  ScenarioAnswer,
  StepId,
} from "@/types/builder";
import type {
  ExecutableContext,
  UserProfile,
} from "@/types/executable-context";
import { STEP_ORDER } from "@/data/steps";

const STORAGE_KEY = "ai-context-builder:v1";
const DEFAULT_PROFILE_ID = "default";
const DEFAULT_PROFILE_NAME = "メインプロファイル";

interface BuilderStore extends BuilderState {
  // --- multi profile ---
  currentProfileId: string;
  profiles: Array<{
    id: string;
    name: string;
    tags: string[];
    updatedAt: string;
  }>;
  profileStates: Record<string, StoredSnapshot>;
  createProfile: (name: string, tags?: string[]) => string;
  duplicateCurrentProfile: (name: string, tags?: string[]) => string;
  switchProfile: (id: string) => void;
  renameProfile: (id: string, name: string) => void;
  setProfileTags: (id: string, tags: string[]) => void;
  deleteProfile: (id: string) => { ok: true } | { ok: false; error: string };

  // --- profile ---
  setProfile: (profile: Partial<UserProfile>) => void;

  // --- personality ---
  setPersonalityAnswer: (answer: PersonalityAnswer) => void;
  setPersonalityAnswers: (answers: PersonalityAnswer[]) => void;

  // --- interview ---
  upsertInterviewClip: (clip: InterviewClip) => void;
  removeInterviewClip: (questionId: string) => void;

  // --- scenarios ---
  setScenarioAnswer: (answer: ScenarioAnswer) => void;

  // --- progress ---
  markCompleted: (step: StepId) => void;
  markIncomplete: (step: StepId) => void;
  goTo: (step: StepId) => void;
  reset: () => void;

  // --- generated context ---
  setContext: (context: ExecutableContext) => void;
  patchContext: (patch: Partial<ExecutableContext>) => void;
  clearContext: () => void;

  // --- exports ---
  setExport: (target: string, markdown: string) => void;
  setExports: (exports: Record<string, string>) => void;
  exportBackup: () => string;
  importBackup: (json: string) => { ok: true } | { ok: false; error: string };

  // --- selectors / derived ---
  isStepCompleted: (step: StepId) => boolean;
  progressRatio: () => number;
}

const emptyCompleted = (): Record<StepId, boolean> =>
  STEP_ORDER.reduce(
    (acc, step) => ({ ...acc, [step]: false }),
    {} as Record<StepId, boolean>,
  );

const initialState: BuilderState = {
  input: {
    profile: {},
    personalityAnswers: [],
    interviewClips: [],
    scenarioAnswers: [],
  },
  progress: {
    currentStep: "onboarding",
    completed: emptyCompleted(),
  },
};

interface BackupPayloadV1 {
  schemaVersion: "backup-v1";
  exportedAt: string;
  data: Pick<
    BuilderState,
    "input" | "progress" | "context" | "contextOverrides" | "exports"
  >;
}
interface BackupPayloadV2 {
  schemaVersion: "backup-v2";
  exportedAt: string;
  data: {
    currentProfileId: string;
    profiles: Array<{
      id: string;
      name: string;
      tags: string[];
      updatedAt: string;
    }>;
    profileStates: Record<string, StoredSnapshot>;
  };
}

type StoredSnapshot = Pick<
  BuilderState,
  "input" | "progress" | "context" | "contextOverrides" | "exports"
>;

const createEmptySnapshot = (): StoredSnapshot => ({
  input: {
    profile: {},
    personalityAnswers: [],
    interviewClips: [],
    scenarioAnswers: [],
  },
  progress: {
    currentStep: "onboarding",
    completed: emptyCompleted(),
  },
  context: undefined,
  contextOverrides: undefined,
  exports: undefined,
});

function normalizeCompleted(
  value: unknown,
): Record<StepId, boolean> {
  const result = emptyCompleted();
  if (!value || typeof value !== "object") return result;
  for (const step of STEP_ORDER) {
    const v = (value as Record<string, unknown>)[step];
    result[step] = Boolean(v);
  }
  return result;
}

function normalizeSnapshot(snapshot: StoredSnapshot): StoredSnapshot {
  return {
    ...snapshot,
    progress: {
      ...snapshot.progress,
      completed: normalizeCompleted(snapshot.progress?.completed),
    },
  };
}

function normalizeProfileStates(
  profileStates: Record<string, StoredSnapshot> | undefined,
): Record<string, StoredSnapshot> {
  if (!profileStates || typeof profileStates !== "object") {
    return { [DEFAULT_PROFILE_ID]: createEmptySnapshot() };
  }
  const next: Record<string, StoredSnapshot> = {};
  for (const [id, snapshot] of Object.entries(profileStates)) {
    if (!snapshot) continue;
    next[id] = normalizeSnapshot(snapshot);
  }
  if (Object.keys(next).length === 0) {
    next[DEFAULT_PROFILE_ID] = createEmptySnapshot();
  }
  return next;
}

export const useBuilderStore = create<BuilderStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      currentProfileId: DEFAULT_PROFILE_ID,
      profiles: [
        {
          id: DEFAULT_PROFILE_ID,
          name: DEFAULT_PROFILE_NAME,
          tags: ["default"],
          updatedAt: new Date().toISOString(),
        },
      ],
      profileStates: {
        [DEFAULT_PROFILE_ID]: createEmptySnapshot(),
      },

      // --- multi profile ---
      createProfile: (name, tags = []) => {
        const state = get();
        const id = `pf_${Date.now()}`;
        const now = new Date().toISOString();
        const currentSnapshot: StoredSnapshot = {
          input: state.input,
          progress: state.progress,
          context: state.context,
          contextOverrides: state.contextOverrides,
          exports: state.exports,
        };
        set(() => ({
          currentProfileId: id,
          profiles: [
            ...state.profiles.map((p) =>
              p.id === state.currentProfileId ? { ...p, updatedAt: now } : p,
            ),
            { id, name: name.trim() || "新しいプロファイル", tags, updatedAt: now },
          ],
          profileStates: {
            ...state.profileStates,
            [state.currentProfileId]: normalizeSnapshot(currentSnapshot),
            [id]: createEmptySnapshot(),
          },
          ...createEmptySnapshot(),
        }));
        return id;
      },
      duplicateCurrentProfile: (name, tags = []) => {
        const state = get();
        const id = `pf_${Date.now()}`;
        const now = new Date().toISOString();
        const currentSnapshot: StoredSnapshot = {
          input: state.input,
          progress: state.progress,
          context: state.context,
          contextOverrides: state.contextOverrides,
          exports: state.exports,
        };
        const baseName =
          name.trim() ||
          `${state.profiles.find((p) => p.id === state.currentProfileId)?.name ?? "プロファイル"} (コピー)`;
        set(() => ({
          currentProfileId: id,
          profiles: [
            ...state.profiles.map((p) =>
              p.id === state.currentProfileId ? { ...p, updatedAt: now } : p,
            ),
            { id, name: baseName, tags, updatedAt: now },
          ],
          profileStates: {
            ...state.profileStates,
            [state.currentProfileId]: normalizeSnapshot(currentSnapshot),
            [id]: normalizeSnapshot(currentSnapshot),
          },
          ...normalizeSnapshot(currentSnapshot),
        }));
        return id;
      },
      switchProfile: (id) => {
        const state = get();
        if (id === state.currentProfileId) return;
        const target = state.profileStates[id];
        if (!target) return;
        const now = new Date().toISOString();
        const currentSnapshot: StoredSnapshot = {
          input: state.input,
          progress: state.progress,
          context: state.context,
          contextOverrides: state.contextOverrides,
          exports: state.exports,
        };
        set(() => ({
          currentProfileId: id,
          profiles: state.profiles.map((p) =>
            p.id === id || p.id === state.currentProfileId
              ? { ...p, updatedAt: now }
              : p,
          ),
          profileStates: {
            ...state.profileStates,
            [state.currentProfileId]: normalizeSnapshot(currentSnapshot),
          },
          ...normalizeSnapshot(target),
        }));
      },
      renameProfile: (id, name) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name } : p,
          ),
        })),
      setProfileTags: (id, tags) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id
              ? {
                  ...p,
                  tags: tags
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0)
                    .slice(0, 8),
                }
              : p,
          ),
        })),
      deleteProfile: (id) => {
        const state = get();
        if (state.profiles.length <= 1) {
          return { ok: false as const, error: "最後の1つは削除できません。" };
        }
        const remainProfiles = state.profiles.filter((p) => p.id !== id);
        const remainStates = { ...state.profileStates };
        delete remainStates[id];
        const nextId =
          state.currentProfileId === id ? remainProfiles[0].id : state.currentProfileId;
        const nextSnapshot = remainStates[nextId] ?? createEmptySnapshot();
        set(() => ({
          currentProfileId: nextId,
          profiles: remainProfiles,
          profileStates: remainStates,
          ...normalizeSnapshot(nextSnapshot),
        }));
        return { ok: true as const };
      },

      // --- profile ---
      setProfile: (profile) =>
        set((state) => ({
          input: {
            ...state.input,
            profile: { ...state.input.profile, ...profile },
          },
          progress: {
            ...state.progress,
            updatedAt: new Date().toISOString(),
            startedAt: state.progress.startedAt ?? new Date().toISOString(),
          },
        })),

      // --- personality ---
      setPersonalityAnswer: (answer) =>
        set((state) => {
          const others = state.input.personalityAnswers.filter(
            (a) => a.questionId !== answer.questionId,
          );
          return {
            input: {
              ...state.input,
              personalityAnswers: [...others, answer],
            },
            progress: {
              ...state.progress,
              updatedAt: new Date().toISOString(),
            },
          };
        }),
      setPersonalityAnswers: (answers) =>
        set((state) => ({
          input: { ...state.input, personalityAnswers: answers },
          progress: {
            ...state.progress,
            updatedAt: new Date().toISOString(),
          },
        })),

      // --- interview ---
      upsertInterviewClip: (clip) =>
        set((state) => {
          const others = state.input.interviewClips.filter(
            (c) => c.questionId !== clip.questionId,
          );
          return {
            input: {
              ...state.input,
              interviewClips: [...others, clip],
            },
            progress: {
              ...state.progress,
              updatedAt: new Date().toISOString(),
            },
          };
        }),
      removeInterviewClip: (questionId) =>
        set((state) => ({
          input: {
            ...state.input,
            interviewClips: state.input.interviewClips.filter(
              (c) => c.questionId !== questionId,
            ),
          },
        })),

      // --- scenarios ---
      setScenarioAnswer: (answer) =>
        set((state) => {
          const others = state.input.scenarioAnswers.filter(
            (a) => a.scenarioId !== answer.scenarioId,
          );
          return {
            input: {
              ...state.input,
              scenarioAnswers: [...others, answer],
            },
            progress: {
              ...state.progress,
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      // --- progress ---
      markCompleted: (step) =>
        set((state) => ({
          progress: {
            ...state.progress,
            completed: { ...state.progress.completed, [step]: true },
            updatedAt: new Date().toISOString(),
          },
        })),
      markIncomplete: (step) =>
        set((state) => ({
          progress: {
            ...state.progress,
            completed: { ...state.progress.completed, [step]: false },
          },
        })),
      goTo: (step) =>
        set((state) => ({
          progress: { ...state.progress, currentStep: step },
        })),
      reset: () =>
        set(() => ({
          ...initialState,
          progress: {
            currentStep: "onboarding",
            completed: emptyCompleted(),
          },
          context: undefined,
          contextOverrides: undefined,
          exports: undefined,
        })),

      // --- generated context ---
      setContext: (context) =>
        set(() => ({ context, contextOverrides: undefined })),
      patchContext: (patch) =>
        set((state) => {
          if (!state.context) return state;
          return {
            context: { ...state.context, ...patch },
            contextOverrides: { ...state.contextOverrides, ...patch },
          };
        }),
      clearContext: () =>
        set(() => ({
          context: undefined,
          contextOverrides: undefined,
          exports: undefined,
        })),

      // --- exports ---
      setExport: (target, markdown) =>
        set((state) => ({
          exports: { ...(state.exports ?? {}), [target]: markdown },
        })),
      setExports: (exports) => set(() => ({ exports })),
      exportBackup: () => {
        const state = get();
        const syncedCurrent: StoredSnapshot = normalizeSnapshot({
          input: state.input,
          progress: state.progress,
          context: state.context,
          contextOverrides: state.contextOverrides,
          exports: state.exports,
        });
        const payload: BackupPayloadV2 = {
          schemaVersion: "backup-v2",
          exportedAt: new Date().toISOString(),
          data: {
            currentProfileId: state.currentProfileId,
            profiles: state.profiles,
            profileStates: {
              ...state.profileStates,
              [state.currentProfileId]: syncedCurrent,
            },
          },
        };
        return JSON.stringify(payload, null, 2);
      },
      importBackup: (json) => {
        try {
          const parsed = JSON.parse(json) as Partial<BackupPayloadV1 | BackupPayloadV2>;
          if (!parsed?.schemaVersion || !parsed.data) {
            return {
              ok: false as const,
              error:
                "バックアップ形式が不正です。ai-context-builder のエクスポートJSONを選択してください。",
            };
          }
          if (parsed.schemaVersion === "backup-v2") {
            const d = parsed.data as BackupPayloadV2["data"];
            if (!d.currentProfileId || !Array.isArray(d.profiles) || !d.profileStates) {
              return {
                ok: false as const,
                error: "バックアップ v2 のデータが不足しています。",
              };
            }
            const normalizedStates = normalizeProfileStates(d.profileStates);
            const profiles = d.profiles.length
              ? d.profiles.map((p) => ({
                  id: p.id,
                  name: p.name?.trim() || "プロファイル",
                  tags: Array.isArray(p.tags) ? p.tags : [],
                  updatedAt: p.updatedAt || new Date().toISOString(),
                }))
              : [
                  {
                    id: DEFAULT_PROFILE_ID,
                    name: DEFAULT_PROFILE_NAME,
                    tags: ["default"],
                    updatedAt: new Date().toISOString(),
                  },
                ];
            const currentProfileId = profiles.some((p) => p.id === d.currentProfileId)
              ? d.currentProfileId
              : profiles[0].id;
            const activeSnapshot =
              normalizedStates[currentProfileId] ?? createEmptySnapshot();
            set(() => ({
              currentProfileId,
              profiles,
              profileStates: normalizedStates,
              ...activeSnapshot,
            }));
            return { ok: true as const };
          }
          if (parsed.schemaVersion === "backup-v1") {
            const d = parsed.data as BackupPayloadV1["data"];
            if (!d.input || !d.progress) {
              return {
                ok: false as const,
                error: "バックアップに必要な入力データが含まれていません。",
              };
            }
            const state = get();
            const currentId = state.currentProfileId || DEFAULT_PROFILE_ID;
            const v1Snapshot: StoredSnapshot = normalizeSnapshot({
              input: d.input,
              progress: {
                ...d.progress,
                completed: normalizeCompleted(d.progress.completed),
              },
              context: d.context,
              contextOverrides: d.contextOverrides,
              exports: d.exports,
            });
            set(() => ({
              profileStates: {
                ...state.profileStates,
                [currentId]: v1Snapshot,
              },
              ...v1Snapshot,
            }));
            return { ok: true as const };
          }
          return {
            ok: false as const,
            error:
              "未対応のバックアップ形式です。最新バージョンで作成したファイルをご利用ください。",
          };
        } catch {
          return {
            ok: false as const,
            error: "JSON の読み込みに失敗しました。ファイルが壊れている可能性があります。",
          };
        }
      },

      // --- selectors ---
      isStepCompleted: (step) => Boolean(get().progress.completed[step]),
      progressRatio: () => {
        const completed = Object.values(get().progress.completed).filter(
          Boolean,
        ).length;
        return completed / STEP_ORDER.length;
      },
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      migrate: (persistedState, version) => {
        // v1 -> v2: 単一状態を default プロファイルへ格納
        if (version < 2) {
          const prev = persistedState as Partial<BuilderState>;
          const snapshot: StoredSnapshot = normalizeSnapshot({
            input: prev.input ?? createEmptySnapshot().input,
            progress: prev.progress ?? createEmptySnapshot().progress,
            context: prev.context,
            contextOverrides: prev.contextOverrides,
            exports: prev.exports,
          });
          return {
            ...prev,
            currentProfileId: DEFAULT_PROFILE_ID,
            profiles: [
              {
                id: DEFAULT_PROFILE_ID,
                name: DEFAULT_PROFILE_NAME,
                tags: ["default"],
                updatedAt: new Date().toISOString(),
              },
            ],
            profileStates: {
              [DEFAULT_PROFILE_ID]: snapshot,
            },
            ...snapshot,
          };
        }
        return persistedState;
      },
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
      partialize: (state) => ({
        currentProfileId: state.currentProfileId,
        profiles: state.profiles,
        profileStates: state.profileStates,
        input: state.input,
        progress: state.progress,
        context: state.context,
        contextOverrides: state.contextOverrides,
        exports: state.exports,
      }),
      merge: (persistedState, currentState) => {
        const merged = {
          ...currentState,
          ...(persistedState as object),
        } as BuilderStore;

        if (!merged.profiles || merged.profiles.length === 0) {
          merged.profiles = [
            {
              id: DEFAULT_PROFILE_ID,
              name: DEFAULT_PROFILE_NAME,
              tags: ["default"],
              updatedAt: new Date().toISOString(),
            },
          ];
        }
        if (!merged.profileStates) {
          merged.profileStates = {
            [DEFAULT_PROFILE_ID]: createEmptySnapshot(),
          };
        }
        if (!merged.currentProfileId) {
          merged.currentProfileId = merged.profiles[0].id;
        }
        return merged;
      },
    },
  ),
);
