"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { countPublisherCharacters } from "@/lib/publisher/input-utils";
import { isoNow } from "@/lib/utils";
import type { PostHistory } from "@/types/publisher";

export const PUBLISHER_STORAGE_KEY = "hue-publisher:history:v1";

interface PublisherStore {
  /** 明示的に保存された、生成一式単位の履歴。 */
  histories: PostHistory[];
  /** 新規保存または同じIDの履歴を一式で更新する。 */
  upsertHistory: (history: PostHistory) => void;
  /** 履歴内のSNS投稿文を編集し、文字数と更新日時も同期する。 */
  updateGeneratedPostText: (
    historyId: string,
    generatedPostId: string,
    text: string,
  ) => void;
}

export const usePublisherStore = create<PublisherStore>()(
  persist(
    (set) => ({
      histories: [],
      upsertHistory: (history) =>
        set((state) => ({
          histories: [
            history,
            ...state.histories.filter((item) => item.id !== history.id),
          ],
        })),
      updateGeneratedPostText: (historyId, generatedPostId, text) =>
        set((state) => {
          const updatedAt = isoNow();
          const targetHistory = state.histories.find(
            (history) => history.id === historyId,
          );
          if (
            !targetHistory ||
            !targetHistory.generatedPosts.some(
              (post) => post.id === generatedPostId,
            )
          ) {
            return state;
          }

          const updatedHistory: PostHistory = {
            ...targetHistory,
            updatedAt,
            generatedPosts: targetHistory.generatedPosts.map((post) =>
              post.id === generatedPostId
                ? {
                    ...post,
                    text,
                    characterCount: countPublisherCharacters(text),
                    updatedAt,
                  }
                : post,
            ),
          };

          return {
            histories: [
              updatedHistory,
              ...state.histories.filter((history) => history.id !== historyId),
            ],
          };
        }),
    }),
    {
      name: PUBLISHER_STORAGE_KEY,
      version: 1,
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
      partialize: (state) => ({ histories: state.histories }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as
          | Partial<Pick<PublisherStore, "histories">>
          | undefined;
        return {
          ...currentState,
          histories: Array.isArray(persisted?.histories)
            ? persisted.histories
            : [],
        };
      },
      // SSRと初回クライアント描画を一致させ、画面側のeffectで明示的に復元する。
      skipHydration: true,
    },
  ),
);
