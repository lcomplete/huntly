import { useCallback, useEffect, useMemo, useRef } from "react";

import type {
  ChatMessage,
  HuntlyModelInfo,
  SessionData,
} from "../types";
import { generateSessionTitleFromFirstMessage } from "../utils/titleGeneration";
import { DEFAULT_SESSION_TITLE, deriveSessionTitle } from "../utils/sessions";

interface UseTitleGenerationOptions {
  /**
   * Returns the currently selected model, or null when nothing is configured.
   * Accessed lazily so the hook reflects the latest user selection without
   * re-running memoized consumers.
   */
  getCurrentModel: () => HuntlyModelInfo | null;
  /** Latest title-generation system prompt. Accessed lazily. */
  getTitleSystemPrompt: () => string;
  /** Read-through to the session ref so we can guard against stale runs. */
  getSessionData: (sessionId: string) => SessionData | undefined;
  /** Persist a session with its newly resolved title. */
  syncSessionSnapshot: (session: SessionData, immediate: boolean) => void;
}

export interface TitleGenerationAPI {
  /** Try to generate a title for `session` if one isn't already in flight. */
  maybeGenerate: (session: SessionData, chatMessages: ChatMessage[]) => void;
  /** Abort any in-flight title generation for this specific session. */
  cancelFor: (sessionId: string) => void;
  /** Abort every in-flight title generation. Used at unmount. */
  cancelAll: () => void;
}

/**
 * Owns the abort controllers + request-key bookkeeping for per-session
 * title generation. Retries once with reasoning enabled when the first
 * attempt returns nothing.
 */
export function useTitleGeneration(
  options: UseTitleGenerationOptions
): TitleGenerationAPI {
  const {
    getCurrentModel,
    getTitleSystemPrompt,
    getSessionData,
    syncSessionSnapshot,
  } = options;

  const abortsRef = useRef<Map<string, AbortController>>(new Map());
  const keysRef = useRef<Map<string, string>>(new Map());
  const settledKeysRef = useRef<Map<string, string>>(new Map());

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const cancelFor = useCallback((sessionId: string) => {
    abortsRef.current.get(sessionId)?.abort();
    abortsRef.current.delete(sessionId);
    keysRef.current.delete(sessionId);
    settledKeysRef.current.delete(sessionId);
  }, []);

  const cancelAll = useCallback(() => {
    for (const controller of abortsRef.current.values()) {
      controller.abort();
    }
    abortsRef.current.clear();
    keysRef.current.clear();
    settledKeysRef.current.clear();
  }, []);

  const maybeGenerate = useCallback(
    (session: SessionData, chatMessages: ChatMessage[]) => {
      const currentModel = optionsRef.current.getCurrentModel();
      if (
        !currentModel ||
        chatMessages.length === 0 ||
        session.titleGenerationStatus === "generated"
      ) {
        return;
      }

      const firstUserMessage = chatMessages.find(
        (message) => message.role === "user"
      );
      if (!firstUserMessage) {
        return;
      }

      const sessionId = session.id;
      const requestKey = `${sessionId}:${firstUserMessage.id || "first-user"}`;
      if (keysRef.current.get(sessionId) === requestKey) {
        return;
      }
      if (settledKeysRef.current.get(sessionId) === requestKey) {
        return;
      }

      // Cancel any previous attempt for this session (e.g. edited first
      // message) and start fresh. Do NOT touch other sessions — parallel
      // conversations each own their title generation run.
      cancelFor(sessionId);

      const controller = new AbortController();
      abortsRef.current.set(sessionId, controller);
      keysRef.current.set(sessionId, requestKey);

      const markRequestSettled = () => {
        settledKeysRef.current.set(sessionId, requestKey);
      };

      const applyTitleResult = (title: string | null) => {
        const currentSession = optionsRef.current.getSessionData(sessionId);
        if (!currentSession) {
          return;
        }

        const currentFirstUserMessage = currentSession.messages.find(
          (message) => message.role === "user"
        );
        const activeRequestKey = currentFirstUserMessage
          ? `${currentSession.id}:${
              currentFirstUserMessage.id || "first-user"
            }`
          : null;

        if (activeRequestKey !== requestKey) {
          return;
        }

        const resolvedTitle =
          title ||
          deriveSessionTitle(currentSession.messages, DEFAULT_SESSION_TITLE);
        if (!resolvedTitle || resolvedTitle === DEFAULT_SESSION_TITLE) {
          markRequestSettled();
          optionsRef.current.syncSessionSnapshot(
            {
              ...currentSession,
              titleGenerationStatus: "failed",
              titleGeneratedAt: undefined,
            },
            true
          );
          return;
        }

        markRequestSettled();
        optionsRef.current.syncSessionSnapshot(
          {
            ...currentSession,
            title: resolvedTitle,
            titleGenerationStatus: "generated",
            titleGeneratedAt: new Date().toISOString(),
          },
          true
        );
      };

      void (async () => {
        let generatedTitle: string | null = null;

        try {
          generatedTitle = await generateSessionTitleFromFirstMessage(
            firstUserMessage,
            currentModel,
            optionsRef.current.getTitleSystemPrompt(),
            false,
            controller.signal
          );
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error(
              "[useTitleGeneration] First attempt failed",
              error
            );
          }
        }

        if (controller.signal.aborted) {
          return;
        }

        if (!generatedTitle) {
          try {
            generatedTitle = await generateSessionTitleFromFirstMessage(
              firstUserMessage,
              currentModel,
              optionsRef.current.getTitleSystemPrompt(),
              true,
              controller.signal
            );
          } catch (error) {
            if (!controller.signal.aborted) {
              console.error(
                "[useTitleGeneration] Retry with thinking failed",
                error
              );
            }
          }
        }

        if (controller.signal.aborted) {
          return;
        }

        applyTitleResult(generatedTitle);
      })().finally(() => {
        if (abortsRef.current.get(sessionId) === controller) {
          abortsRef.current.delete(sessionId);
        }
        if (keysRef.current.get(sessionId) === requestKey) {
          keysRef.current.delete(sessionId);
        }
      });
    },
    [cancelFor]
  );

  return useMemo(
    () => ({ maybeGenerate, cancelFor, cancelAll }),
    [maybeGenerate, cancelFor, cancelAll]
  );
}
