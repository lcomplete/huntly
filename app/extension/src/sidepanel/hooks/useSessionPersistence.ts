import { useCallback, useEffect, useRef } from "react";
import { deleteSession, saveSession } from "../sessionStorage";
import type { SessionData } from "../types";

const SAVE_DEBOUNCE_MS = 1000;

interface PersistenceAPI {
  /** Persist a session. `immediate` bypasses debounce (used when a run finishes). */
  persist: (session: SessionData, immediate: boolean) => void;
  /** Mark a session as deleted and cancel any pending save. */
  markDeleted: (id: string) => void;
  /** Cancel any pending debounced save without flushing. */
  cancelPending: () => void;
  /** Flush a pending save immediately (used on unmount). */
  flush: () => void;
}

/**
 * Encapsulates the debounce + serial-write queue + delete-cancel logic for
 * persisting chat sessions to `chrome.storage.local`. Keeps the component
 * free of ref-juggling for persistence concerns.
 */
export function useSessionPersistence(): PersistenceAPI {
  const pendingRef = useRef<SessionData | null>(null);
  const timerRef = useRef<number | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const deletedIdsRef = useRef<Set<string>>(new Set());

  const enqueueSave = useCallback((session: SessionData) => {
    queueRef.current = queueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (deletedIdsRef.current.has(session.id)) return;

        await saveSession(session);

        if (deletedIdsRef.current.has(session.id)) {
          await deleteSession(session.id);
        }
      })
      .catch((error) => {
        console.error("[useSessionPersistence] Failed to save session", error);
      });
  }, []);

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  const persist = useCallback(
    (session: SessionData, immediate: boolean) => {
      if (immediate) {
        cancelPending();
        enqueueSave(session);
        return;
      }

      pendingRef.current = session;
      if (timerRef.current !== null) return;

      timerRef.current = window.setTimeout(() => {
        const pending = pendingRef.current;
        pendingRef.current = null;
        timerRef.current = null;

        if (pending) enqueueSave(pending);
      }, SAVE_DEBOUNCE_MS);
    },
    [cancelPending, enqueueSave]
  );

  const markDeleted = useCallback(
    (id: string) => {
      deletedIdsRef.current.add(id);
      if (pendingRef.current?.id === id) {
        cancelPending();
      }
    },
    [cancelPending]
  );

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) enqueueSave(pending);
  }, [enqueueSave]);

  useEffect(() => {
    return flush;
  }, [flush]);

  return { persist, markDeleted, cancelPending, flush };
}
