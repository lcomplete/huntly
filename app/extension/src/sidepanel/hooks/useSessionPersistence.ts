import { useCallback, useEffect, useMemo, useRef } from "react";
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
  /** Flush pending work and wait for queued writes to finish. */
  flush: () => Promise<void>;
}

/**
 * Encapsulates the debounce + serial-write queue + delete-cancel logic for
 * persisting chat sessions to IndexedDB. Keeps the component
 * free of ref-juggling for persistence concerns.
 */
export function useSessionPersistence(): PersistenceAPI {
  const pendingRef = useRef<SessionData | null>(null);
  const timerRef = useRef<number | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const deletedIdsRef = useRef<Set<string>>(new Set());

  const enqueueSave = useCallback((session: SessionData): Promise<void> => {
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

    return queueRef.current;
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

  const flush = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const pending = pendingRef.current;
    pendingRef.current = null;

    if (pending) {
      await enqueueSave(pending);
      return;
    }

    await queueRef.current.catch(() => undefined);
  }, [enqueueSave]);

  useEffect(() => {
    return () => {
      void flush();
    };
  }, [flush]);

  return useMemo(
    () => ({ persist, markDeleted, cancelPending, flush }),
    [persist, markDeleted, cancelPending, flush]
  );
}
