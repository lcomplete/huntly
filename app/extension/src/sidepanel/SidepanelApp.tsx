import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import { type ChatStatus } from "ai";
import { ChevronDown } from "lucide-react";

import {
  convertUIMessagesToChatMessages,
  useHuntlyChat,
  type HuntlyUIMessage,
} from "./useHuntlyChat";
import { SessionChatPool, type SessionChatConfig } from "./chatPool";
import type {
  ChatMessage,
  ChatPart,
  HuntlyModelInfo,
  SessionData,
  SessionMetadata,
  SlashPrompt,
} from "./types";
import {
  findModelByKey,
  getModelKey,
  resolveModelSelection,
} from "./modelBridge";
import {
  buildSessionMetadata,
  createEmptySession,
  deleteSession,
  getSession,
  listSessionMetadata,
  markSessionOpened,
  renameSession,
  setSessionArchived,
  setSessionPinned,
} from "./sessionStorage";
import {
  composePromptMessage,
  filterPrompts,
  loadSlashPrompts,
  parsePromptInput,
} from "./agentPrompts";
import {
  getSidepanelSelectedModelId,
  getSidepanelThinkingModeEnabled,
  readSyncStorageSettings,
  saveSidepanelSelectedModelId,
  saveSidepanelThinkingModeEnabled,
} from "../storage";
import {
  buildSidepanelTitleGenerationSystemPrompt,
  buildSidepanelSystemPrompt,
  loadSidepanelTitleGenerationSystemPrompt,
  loadSidepanelSystemPrompt,
} from "./systemPrompt";
import { loadModels } from "./utils/loadModels";
import {
  clearDraggedImageSource,
  clonePageContextPart,
  createAttachmentPart,
  createAttachmentPartFromDataUrl,
  createAttachmentPartFromUrl,
  createCurrentPageContextPart,
  createPageContextPart,
  getDraggedImageSource,
  onConfigChange,
  pageContextToTabContext,
} from "./utils/tabContext";
import { generateId } from "./utils/ids";
import {
  addSlashPromptToInput,
  getDisplayMessageText,
} from "./utils/messageParts";
import {
  DEFAULT_SESSION_TITLE,
  getLatestMessage,
  sortSessionMetadataByActivity,
  getStoredLastMessageAt,
  getStoredLastMessageId,
} from "./utils/sessions";
import { isComposingEnterEvent, useAutosizeTextArea } from "./utils/dom";
import { extractDroppedPayload, isImageDataUrl } from "./utils/dropPayload";
import type { PendingSidepanelContextCommand } from "./utils/pendingContextCommand";
import { useSessionPersistence } from "./hooks/useSessionPersistence";
import { useDragAndDropZone } from "./hooks/useDragAndDropZone";
import { useScrollPinToBottom } from "./hooks/useScrollPinToBottom";
import { useSidepanelContextMenu } from "./hooks/useSidepanelContextMenu";
import { useTabContextWatcher } from "./hooks/useTabContextWatcher";
import { useTitleGeneration } from "./hooks/useTitleGeneration";
import { Composer } from "./components/Composer";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { MessageList } from "./components/MessageList";
import {
  EmptyProviders,
  LoadingScreen,
  WelcomePane,
} from "./components/Placeholders";
import { useI18n } from "../i18n";

type ChromeStorageChange = {
  newValue?: unknown;
};

type ChromeApi = {
  runtime?: {
    getURL?: (path: string) => string;
    sendMessage?: (message: unknown) => void;
  };
  storage?: {
    onChanged?: {
      addListener: (
        handler: (
          changes: Record<string, ChromeStorageChange>,
          areaName: string
        ) => void
      ) => void;
      removeListener: (
        handler: (
          changes: Record<string, ChromeStorageChange>,
          areaName: string
        ) => void
      ) => void;
    };
  };
  tabs?: {
    create?: (options: { url: string }) => void;
  };
};

function getChromeApi(): ChromeApi | undefined {
  return (globalThis as typeof globalThis & { chrome?: ChromeApi }).chrome;
}

const SCROLL_PIN_THRESHOLD_PX = 96;

export const SidepanelApp: FC = () => {
  const { t } = useI18n();
  const [models, setModels] = useState<HuntlyModelInfo[]>([]);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [slashPrompts, setSlashPrompts] = useState<SlashPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [huntlyMcpEnabled, setHuntlyMcpEnabled] = useState(false);
  const [statusAction, setStatusAction] = useState<"retry" | "compact" | null>(
    null
  );
  const [attachedPageContext, setAttachedPageContext] =
    useState<ChatPart | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [editingUserMessageId, setEditingUserMessageId] = useState<
    string | null
  >(null);
  const [editingUserMessageText, setEditingUserMessageText] = useState("");
  const [attachments, setAttachments] = useState<ChatPart[]>([]);
  const [attachmentProcessingLabel, setAttachmentProcessingLabel] = useState<
    string | null
  >(null);
  const [slashPromptIndex, setSlashPromptIndex] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState(() =>
    buildSidepanelSystemPrompt("English")
  );
  const [titleGenerationSystemPrompt, setTitleGenerationSystemPrompt] =
    useState(() => buildSidepanelTitleGenerationSystemPrompt("English"));

  const currentModelRef = useRef<HuntlyModelInfo | null>(null);
  const thinkingModeRef = useRef(false);
  const sessionsDataRef = useRef<Map<string, SessionData>>(new Map());
  const previousSessionMessagesRef = useRef<Map<string, ChatMessage[]>>(
    new Map()
  );
  const currentSessionIdRef = useRef<string | null>(null);
  const configRef = useRef<SessionChatConfig | null>(null);
  const titleGenerationSystemPromptRef = useRef(
    buildSidepanelTitleGenerationSystemPrompt("English")
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const persistence = useSessionPersistence();
  const tabContext = useTabContextWatcher({
    paused: Boolean(attachedPageContext),
    onRefreshed: () => setContextError(null),
  });

  useAutosizeTextArea(inputRef, inputText);

  useEffect(() => {
    currentModelRef.current = findModelByKey(models, currentModelId);
  }, [models, currentModelId]);

  useEffect(() => {
    thinkingModeRef.current = thinkingMode;
  }, [thinkingMode]);

  useEffect(() => {
    titleGenerationSystemPromptRef.current = titleGenerationSystemPrompt;
  }, [titleGenerationSystemPrompt]);

  // Shared configuration for every pooled Chat. Updated here on every render;
  // pool transports read this ref lazily at send time, so changes take effect
  // for every session's next request without rebuilding Chat instances.
  useEffect(() => {
    const activeModel = findModelByKey(models, currentModelId);
    configRef.current = activeModel
      ? {
          modelInfo: activeModel,
          systemPrompt,
          thinkingEnabled: thinkingMode,
        }
      : null;
  }, [models, currentModelId, systemPrompt, thinkingMode]);

  // Stable pool instance. The event handler is stored in a ref so we can
  // update its closure without ever tearing down or recreating the pool
  // (which would discard running streams).
  const poolEventHandlerRef = useRef<
    (
      sessionId: string,
      snapshot: {
        messages: HuntlyUIMessage[];
        status: ChatStatus;
        error: Error | undefined;
        rollingSummary?: SessionData["rollingSummary"];
      }
    ) => void
  >(() => {});
  const [pool] = useState(
    () =>
      new SessionChatPool(
        () => configRef.current,
        (sessionId, snapshot) =>
          poolEventHandlerRef.current(sessionId, snapshot)
      )
  );

  const syncSessionSnapshot = useCallback(
    (updated: SessionData, immediate: boolean) => {
      sessionsDataRef.current.set(updated.id, updated);
      setSessions((previous) => {
        const metadata = buildSessionMetadata(updated);
        const existingIndex = previous.findIndex(
          (storedSession) => storedSession.id === metadata.id
        );

        if (existingIndex === -1) {
          return sortSessionMetadataByActivity([metadata, ...previous]);
        }

        const nextSessions = [...previous];
        nextSessions[existingIndex] = {
          ...nextSessions[existingIndex],
          ...metadata,
        };
        return sortSessionMetadataByActivity(nextSessions);
      });
      persistence.persist(updated, immediate);
    },
    [persistence]
  );

  const titleGeneration = useTitleGeneration({
    getCurrentModel: () => currentModelRef.current,
    getTitleSystemPrompt: () => titleGenerationSystemPromptRef.current,
    getSessionData: (id) => sessionsDataRef.current.get(id),
    syncSessionSnapshot,
  });

  /**
   * Drop a pool entry that was never used (no persisted messages, idle status).
   * Prevents accumulating empty draft Chats when the user keeps clicking
   * "New chat" without sending anything.
   */
  const pruneEmptyDraft = useCallback(
    (sessionId: string | null) => {
      if (!sessionId) return;
      if (sessionsDataRef.current.has(sessionId)) return;
      if (pool.isRunning(sessionId)) return;
      const chat = pool.get(sessionId);
      if (chat && chat.messages.length > 0) return;
      pool.remove(sessionId);
      previousSessionMessagesRef.current.delete(sessionId);
      titleGeneration.cancelFor(sessionId);
    },
    [pool, titleGeneration]
  );

  const refreshSessions = useCallback(async () => {
    try {
      const storedSessions = await listSessionMetadata();
      const liveSessions = Array.from(sessionsDataRef.current.values());

      if (liveSessions.length === 0) {
        setSessions(storedSessions);
        return;
      }

      const merged = [...storedSessions];
      for (const liveSession of liveSessions) {
        const liveMetadata = buildSessionMetadata(liveSession);
        const existingIndex = merged.findIndex(
          (session) => session.id === liveMetadata.id
        );
        if (existingIndex === -1) {
          merged.push(liveMetadata);
        } else {
          merged[existingIndex] = {
            ...merged[existingIndex],
            ...liveMetadata,
          };
        }
      }

      setSessions(sortSessionMetadataByActivity(merged));
    } catch (error) {
      console.error("[SidepanelApp] Failed to list sessions", error);
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const handleSessionMessagesChange = useCallback(
    (
      sessionId: string,
      chatMessages: ChatMessage[],
      rollingSummary?: SessionData["rollingSummary"]
    ) => {
      // Empty drafts (no messages yet) are kept entirely in-memory and never
      // persisted. They are only created on the user's first send below.
      if (chatMessages.length === 0) {
        return;
      }

      const existing = sessionsDataRef.current.get(sessionId);
      let session = existing;
      const isNewSession = !session;
      if (!session) {
        session = createEmptySession(
          currentModelRef.current ? getModelKey(currentModelRef.current) : null,
          sessionId
        );
        sessionsDataRef.current.set(sessionId, session);
      }

      const now = new Date().toISOString();
      const latestMessage = getLatestMessage(chatMessages);
      const prevLastMessage =
        session.messages.length > 0
          ? session.messages[session.messages.length - 1]
          : null;
      const prevLatestId = getStoredLastMessageId(session);
      const isStreaming = latestMessage?.status === "running";
      const latestChanged =
        isNewSession ||
        chatMessages.length !== session.messages.length ||
        latestMessage?.id !== (prevLastMessage?.id ?? prevLatestId) ||
        latestMessage?.status !== prevLastMessage?.status ||
        isStreaming;

      const summaryChanged =
        session.rollingSummary?.text !== rollingSummary?.text ||
        session.rollingSummary?.summarizedThroughMessageId !==
          rollingSummary?.summarizedThroughMessageId ||
        session.rollingSummary?.version !== rollingSummary?.version;

      if (!latestChanged && !summaryChanged) {
        return;
      }

      // Only the active session reflects the user-selected model/thinking
      // switch into its persisted record; background sessions keep whatever
      // they were configured with at send time so switching the UI model
      // does not silently rewrite history.
      const isActiveSession = sessionId === currentSessionIdRef.current;
      const activeModelKey = currentModelRef.current
        ? getModelKey(currentModelRef.current)
        : null;

      const titleGenerationStatus =
        session.titleGenerationStatus === "generated" ||
        session.titleGenerationStatus === "failed"
          ? session.titleGenerationStatus
          : "idle";

      const updated: SessionData = {
        ...session,
        title: (session.title || "").trim() || DEFAULT_SESSION_TITLE,
        titleGenerationStatus,
        titleGeneratedAt:
          titleGenerationStatus === "generated"
            ? session.titleGeneratedAt
            : undefined,
        currentModelId: isActiveSession
          ? activeModelKey
          : session.currentModelId,
        thinkingEnabled: isActiveSession
          ? thinkingModeRef.current
          : session.thinkingEnabled,
        rollingSummary,
        messages: chatMessages,
        updatedAt: now,
        lastMessageAt: latestChanged ? now : session.lastMessageAt,
        lastMessageId: latestChanged
          ? latestMessage?.id || prevLatestId
          : prevLatestId,
        lastOpenedAt:
          latestChanged && isActiveSession
            ? now
            : session.lastOpenedAt || session.updatedAt || session.createdAt,
      };

      syncSessionSnapshot(updated, !isStreaming);

      // Title generation is off the hot path: start as soon as the first user
      // message is present instead of waiting for the assistant stream to end.
      // The hook dedupes repeated streaming snapshots for the same first turn.
      if (latestChanged) {
        titleGeneration.maybeGenerate(updated, chatMessages);
      }
    },
    [syncSessionSnapshot, titleGeneration]
  );

  // Pool event handler converts the AI SDK UI snapshot into our local
  // ChatMessage shape and feeds the per-session messages handler. Stored as
  // a ref so updating its closure does not require recreating the pool.
  useEffect(() => {
    poolEventHandlerRef.current = (sessionId, snapshot) => {
      const previous = previousSessionMessagesRef.current.get(sessionId) || [];
      const chatMessages = convertUIMessagesToChatMessages(
        snapshot.messages,
        snapshot.status,
        snapshot.error,
        previous
      );
      previousSessionMessagesRef.current.set(sessionId, chatMessages);
      handleSessionMessagesChange(
        sessionId,
        chatMessages,
        snapshot.rollingSummary
      );
    };
  }, [handleSessionMessagesChange]);

  const currentModel = useMemo(
    () => findModelByKey(models, currentModelId),
    [models, currentModelId]
  );

  // Subscribe the UI to the active session's Chat. Background sessions keep
  // streaming; only this hook drives composer/MessageList rendering for the
  // currently displayed session.
  const activeChat = useMemo(() => {
    if (!currentSessionId) return null;
    return pool.get(currentSessionId);
  }, [currentSessionId, pool]);

  const chat = useHuntlyChat({
    chat: activeChat,
    hasModel: Boolean(currentModel),
  });

  const {
    messages,
    isRunning,
    sendMessage,
    regenerate,
    retryLastRun,
    cancelRun,
    setMessages,
    clearMessages,
  } = chat;

  const {
    scrollContainerRef: messageScrollRef,
    messagesEndRef,
    showScrollToBottom,
    handleScroll: handleMessageScroll,
    scrollToBottom,
  } = useScrollPinToBottom({
    messages,
    thresholdPx: SCROLL_PIN_THRESHOLD_PX,
  });

  // Ensure there is always an active draft session once the app has finished
  // loading, so the composer can send without waiting for a re-render after
  // creating a Chat.
  useEffect(() => {
    if (loading) return;
    if (currentSessionIdRef.current) return;
    const draftId = generateId();
    pool.ensure(draftId);
    currentSessionIdRef.current = draftId;
    setCurrentSessionId(draftId);
  }, [loading, pool]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [
        availableModels,
        prompts,
        savedModelId,
        savedThinkingMode,
        loadedSystemPrompt,
        loadedTitleGenerationSystemPrompt,
        syncSettings,
      ] = await Promise.all([
        loadModels(),
        loadSlashPrompts(),
        getSidepanelSelectedModelId(),
        getSidepanelThinkingModeEnabled(),
        loadSidepanelSystemPrompt(),
        loadSidepanelTitleGenerationSystemPrompt(),
        readSyncStorageSettings(),
      ]);
      if (cancelled) return;

      setModels(availableModels);
      setSlashPrompts(prompts);
      setThinkingMode(savedThinkingMode);
      setSystemPrompt(loadedSystemPrompt);
      setTitleGenerationSystemPrompt(loadedTitleGenerationSystemPrompt);
      setHuntlyMcpEnabled(Boolean(syncSettings.serverUrl?.trim()));

      if (availableModels.length > 0) {
        const resolution = resolveModelSelection(
          availableModels,
          savedModelId,
          savedModelId
        );
        if (resolution.resolvedKey) setCurrentModelId(resolution.resolvedKey);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onConfigChange(async () => {
      const [
        updatedModels,
        updatedPrompts,
        updatedSystemPrompt,
        updatedTitleGenerationSystemPrompt,
        updatedSyncSettings,
      ] = await Promise.all([
        loadModels(),
        loadSlashPrompts(),
        loadSidepanelSystemPrompt(),
        loadSidepanelTitleGenerationSystemPrompt(),
        readSyncStorageSettings(),
      ]);
      setModels(updatedModels);
      setSlashPrompts(updatedPrompts);
      setSystemPrompt(updatedSystemPrompt);
      setTitleGenerationSystemPrompt(updatedTitleGenerationSystemPrompt);
      setHuntlyMcpEnabled(Boolean(updatedSyncSettings.serverUrl?.trim()));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const onChanged = getChromeApi()?.storage?.onChanged;
    if (!onChanged) return;

    const handler = (
      changes: Record<string, ChromeStorageChange>,
      areaName: string
    ) => {
      if (areaName !== "sync") return;
      if (!("serverUrl" in changes)) return;
      const nextUrl = changes.serverUrl?.newValue as string | undefined;
      setHuntlyMcpEnabled(Boolean(nextUrl?.trim()));
    };
    onChanged.addListener(handler);
    return () => onChanged.removeListener(handler);
  }, []);

  useEffect(() => {
    setStatusAction(null);
  }, [currentSessionId]);

  useEffect(() => {
    const flushPendingSession = () => {
      void persistence.flush();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void persistence.flush();
      }
    };

    window.addEventListener("pagehide", flushPendingSession);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushPendingSession);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      titleGeneration.cancelAll();
      pool.disposeAll();
    };
  }, [persistence, pool, titleGeneration]);

  const filteredPrompts = useMemo(
    () =>
      inputText.startsWith("/") ? filterPrompts(inputText, slashPrompts) : [],
    [inputText, slashPrompts]
  );

  const handleModelSelect = useCallback(async (model: HuntlyModelInfo) => {
    const key = getModelKey(model);
    setCurrentModelId(key);
    await saveSidepanelSelectedModelId(key);
  }, []);

  const handleToggleHistory = useCallback(() => {
    setHistoryOpen((open) => {
      const next = !open;
      if (next) void refreshSessions();
      return next;
    });
  }, [refreshSessions]);

  const handleCloseHistory = useCallback(() => {
    setHistoryOpen(false);
  }, []);

  const clearInlineUserMessageEdit = useCallback(() => {
    setEditingUserMessageId(null);
    setEditingUserMessageText("");
  }, []);

  const resetComposerState = useCallback(() => {
    setAttachedPageContext(null);
    setContextError(null);
    setAttachments([]);
    setAttachmentProcessingLabel(null);
  }, []);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await persistence.flush();
      persistence.markDeleted(id);
      titleGeneration.cancelFor(id);
      pool.remove(id);
      sessionsDataRef.current.delete(id);
      previousSessionMessagesRef.current.delete(id);

      await deleteSession(id);
      setSessions((previous) =>
        previous.filter((session) => session.id !== id)
      );

      if (currentSessionIdRef.current === id) {
        // Switch to a fresh draft so the composer is still usable.
        const draftId = generateId();
        pool.ensure(draftId);
        currentSessionIdRef.current = draftId;
        setCurrentSessionId(draftId);
        clearInlineUserMessageEdit();
        resetComposerState();
      }
    },
    [
      clearInlineUserMessageEdit,
      persistence,
      pool,
      resetComposerState,
      titleGeneration,
    ]
  );

  const applyMetadataPatch = useCallback((updated: SessionMetadata) => {
    setSessions((previous) => {
      const existingIndex = previous.findIndex(
        (session) => session.id === updated.id
      );
      if (existingIndex === -1) {
        return sortSessionMetadataByActivity([updated, ...previous]);
      }
      const next = [...previous];
      next[existingIndex] = { ...next[existingIndex], ...updated };
      return sortSessionMetadataByActivity(next);
    });

    const liveSession = sessionsDataRef.current.get(updated.id);
    if (liveSession) {
      sessionsDataRef.current.set(updated.id, {
        ...liveSession,
        title: updated.title,
        titleGenerationStatus: updated.titleGenerationStatus,
        titleGeneratedAt: updated.titleGeneratedAt,
        pinned: updated.pinned,
        pinnedAt: updated.pinnedAt,
        archived: updated.archived,
        archivedAt: updated.archivedAt,
      });
    }
  }, []);

  const handleRenameSession = useCallback(
    async (id: string, title: string) => {
      try {
        await persistence.flush();
        const updated = await renameSession(id, title);
        if (updated) {
          applyMetadataPatch(updated);
        }
      } catch (error) {
        console.error("[SidepanelApp] Failed to rename session", error);
      }
    },
    [applyMetadataPatch, persistence]
  );

  const handleTogglePinned = useCallback(
    async (id: string, pinned: boolean) => {
      try {
        await persistence.flush();
        const updated = await setSessionPinned(id, pinned);
        if (updated) {
          applyMetadataPatch(updated);
        }
      } catch (error) {
        console.error("[SidepanelApp] Failed to toggle pinned", error);
      }
    },
    [applyMetadataPatch, persistence]
  );

  const handleToggleArchived = useCallback(
    async (id: string, archived: boolean) => {
      try {
        await persistence.flush();
        const updated = await setSessionArchived(id, archived);
        if (updated) {
          applyMetadataPatch(updated);
        }
      } catch (error) {
        console.error("[SidepanelApp] Failed to toggle archived", error);
      }
    },
    [applyMetadataPatch, persistence]
  );

  const handleToggleShowArchived = useCallback(() => {
    setShowArchived((value) => !value);
  }, []);

  const handleSelectSession = useCallback(
    async (id: string) => {
      try {
        if (id === currentSessionIdRef.current) {
          setHistoryOpen(false);
          return;
        }

        // Switch sessions WITHOUT cancelling the previously active session.
        // The pool keeps that Chat alive so its stream continues in the
        // background; persistence and title generation stay wired up.
        let openedSession: SessionData | null =
          sessionsDataRef.current.get(id) ?? null;
        let chatMessages: ChatMessage[];

        if (pool.has(id) && openedSession) {
          chatMessages = openedSession.messages || [];
        } else {
          await persistence.flush();
          const stored = await getSession(id);
          if (!stored) {
            return;
          }
          chatMessages = (stored.messages || []).map((message) => ({
            id: message.id || generateId(),
            role: message.role,
            parts: message.parts || [],
            status: message.status || "complete",
          }));

          const latestMessage = getLatestMessage(chatMessages);
          openedSession = {
            ...stored,
            messages: chatMessages,
            lastMessageAt:
              getStoredLastMessageAt(stored) ||
              (latestMessage ? stored.updatedAt : undefined),
            lastMessageId: getStoredLastMessageId(stored) || latestMessage?.id,
          };
          sessionsDataRef.current.set(id, openedSession);
          previousSessionMessagesRef.current.set(id, chatMessages);
          pool.ensure(id, chatMessages, openedSession.rollingSummary);
        }

        const openedAt = new Date().toISOString();
        const finalSession: SessionData = {
          ...openedSession,
          lastOpenedAt: openedAt,
        };
        sessionsDataRef.current.set(id, finalSession);
        const previousId = currentSessionIdRef.current;
        currentSessionIdRef.current = id;
        setCurrentSessionId(id);
        pruneEmptyDraft(previousId);

        clearInlineUserMessageEdit();
        resetComposerState();
        setHistoryOpen(false);
        setSessions((previous) =>
          previous.map((storedSession) =>
            storedSession.id === id
              ? {
                  ...storedSession,
                  title: finalSession.title,
                  titleGenerationStatus: finalSession.titleGenerationStatus,
                  titleGeneratedAt: finalSession.titleGeneratedAt,
                  lastOpenedAt: openedAt,
                }
              : storedSession
          )
        );

        void markSessionOpened(id, openedAt).catch((error) => {
          console.error("[SidepanelApp] Failed to mark session opened", error);
        });
        titleGeneration.maybeGenerate(finalSession, chatMessages);
      } catch (error) {
        console.error("[SidepanelApp] Failed to open session", error);
      }
    },
    [
      clearInlineUserMessageEdit,
      persistence,
      pool,
      pruneEmptyDraft,
      resetComposerState,
      titleGeneration,
    ]
  );

  const handleNewChat = useCallback(() => {
    // Don't cancel any running session. Just open a fresh draft chat; the
    // previous session keeps streaming via the pool until it completes.
    const previousId = currentSessionIdRef.current;
    const draftId = generateId();
    pool.ensure(draftId);
    currentSessionIdRef.current = draftId;
    setCurrentSessionId(draftId);
    pruneEmptyDraft(previousId);
    setHistoryOpen(false);
    clearInlineUserMessageEdit();
    setInputText("");
    setSlashPromptIndex(0);
    resetComposerState();
    inputRef.current?.focus();
  }, [clearInlineUserMessageEdit, pool, pruneEmptyDraft, resetComposerState]);

  const prepareOutgoingText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return "";
      }

      const parsed = parsePromptInput(trimmed, slashPrompts);
      return parsed.prompt ? composePromptMessage(parsed) : trimmed;
    },
    [slashPrompts]
  );

  const handleThinkingModeToggle = useCallback(() => {
    setThinkingMode((previous) => {
      const next = !previous;
      void saveSidepanelThinkingModeEnabled(next);
      return next;
    });
  }, []);

  const attachFiles = useCallback(async (files: File[] | FileList) => {
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) return false;

    const parts = await Promise.all(selectedFiles.map(createAttachmentPart));
    setAttachments((previous) => [...previous, ...parts]);
    return true;
  }, []);

  const handleAttachmentFiles = useCallback(
    (files: File[] | FileList) => {
      const selectedFiles = Array.from(files);
      if (selectedFiles.length === 0) return;

      setAttachmentProcessingLabel(
        selectedFiles.length > 1
          ? t("sidepanel.processing.attachments")
          : t("sidepanel.processing.attachment")
      );

      void attachFiles(selectedFiles)
        .catch((error) => {
          console.error("[SidepanelApp] Failed to read attachment", error);
        })
        .finally(() => {
          setAttachmentProcessingLabel(null);
        });
    },
    [attachFiles, t]
  );

  const addAttachmentFromSource = useCallback(async (source: string) => {
    try {
      const part = isImageDataUrl(source)
        ? await createAttachmentPartFromDataUrl(source)
        : await createAttachmentPartFromUrl(source);
      setAttachments((previous) => [...previous, part]);
      return true;
    } catch (error) {
      console.error("[SidepanelApp] Failed to attach dropped image", error);
      return false;
    }
  }, []);

  const appendPendingContextCommands = useCallback(
    async (commands: PendingSidepanelContextCommand[]) => {
      if (commands.length === 0) {
        return [] as string[];
      }

      setAttachmentProcessingLabel(t("sidepanel.processing.chatContext"));

      const completedIds: string[] = [];
      try {
        for (const command of commands) {
          if (command.kind === "image") {
            const attached = await addAttachmentFromSource(command.source);
            if (attached) {
              completedIds.push(command.id);
            }
            continue;
          }

          if (command.kind === "page-context") {
            try {
              const part = await createCurrentPageContextPart();
              setAttachedPageContext(part);
              setContextError(null);
              completedIds.push(command.id);
            } catch (error) {
              console.error(
                "[SidepanelApp] Failed to attach page context",
                error
              );
              setContextError(t("sidepanel.error.readTab"));
            }
            continue;
          }

          try {
            const part = createPageContextPart(command.page, {
              title:
                command.page.title || t("sidepanel.context.selectedContent"),
              url: command.page.url,
              faviconUrl: command.page.faviconUrl,
            });
            setAttachedPageContext(part);
            setContextError(null);
            completedIds.push(command.id);
          } catch (error) {
            console.error(
              "[SidepanelApp] Failed to attach selection context",
              error
            );
            setContextError(t("sidepanel.error.readSelection"));
          }
        }

        if (completedIds.length > 0) {
          inputRef.current?.focus();
        }

        return completedIds;
      } finally {
        setAttachmentProcessingLabel(null);
      }
    },
    [addAttachmentFromSource, t]
  );

  useSidepanelContextMenu(appendPendingContextCommands);

  const handleDropPayload = useCallback(
    async (dataTransfer: DataTransfer) => {
      const { files, sources } = await extractDroppedPayload(
        dataTransfer,
        tabContext?.url
      );

      try {
        if (files.length > 0) {
          setAttachmentProcessingLabel(
            files.length > 1
              ? t("sidepanel.processing.droppedFiles")
              : t("sidepanel.processing.droppedFile")
          );
          await attachFiles(files);
          return;
        }

        setAttachmentProcessingLabel(t("sidepanel.processing.droppedImage"));
        let attached = false;
        const draggedSource = await getDraggedImageSource();
        if (draggedSource) {
          attached = await addAttachmentFromSource(draggedSource);
        }

        if (!attached) {
          for (const source of sources) {
            attached = await addAttachmentFromSource(source);
            if (attached) {
              break;
            }
          }
        }

        if (attached) {
          await clearDraggedImageSource();
        }
      } catch (error) {
        console.error("[SidepanelApp] Failed to handle drop", error);
      } finally {
        setAttachmentProcessingLabel(null);
      }
    },
    [addAttachmentFromSource, attachFiles, t, tabContext?.url]
  );

  const { isDraggingOver, handlers: dragHandlers } = useDragAndDropZone({
    onDrop: handleDropPayload,
  });

  const handleAttachmentRemove = useCallback((id: string) => {
    setAttachments((previous) => previous.filter((part) => part.id !== id));
  }, []);

  const handleEditUserMessage = useCallback(
    (messageId: string) => {
      if (isRunning) {
        return;
      }

      const message = messages.find(
        (candidate) => candidate.id === messageId && candidate.role === "user"
      );
      if (!message) {
        return;
      }

      setEditingUserMessageId(messageId);
      setEditingUserMessageText(getDisplayMessageText(message.parts));
    },
    [isRunning, messages]
  );

  const handleEditUserMessageTextChange = useCallback((value: string) => {
    setEditingUserMessageText(value);
  }, []);

  const handleCancelUserMessageEdit = useCallback(() => {
    clearInlineUserMessageEdit();
  }, [clearInlineUserMessageEdit]);

  const handleSaveUserMessageEdit = useCallback(
    (messageId: string) => {
      if (isRunning || messageId !== editingUserMessageId) {
        return;
      }

      const messageIndex = messages.findIndex(
        (message) => message.id === messageId && message.role === "user"
      );
      if (messageIndex === -1) {
        clearInlineUserMessageEdit();
        return;
      }

      const message = messages[messageIndex];
      const previousMessages = messages;
      const preservedParts = message.parts.flatMap((part) => {
        if (part.type === "page-context") {
          return [clonePageContextPart(part)];
        }

        if (part.type === "file") {
          return [{ ...part }];
        }

        return [];
      });
      const remainingMessages = messages.slice(0, messageIndex);
      const finalText = prepareOutgoingText(editingUserMessageText);

      if (remainingMessages.length > 0) {
        setMessages(remainingMessages);
      } else {
        clearMessages();
      }

      const sent = sendMessage(finalText, preservedParts);
      if (!sent) {
        setMessages(previousMessages);
        return;
      }

      const activeSessionId = currentSessionIdRef.current;
      if (activeSessionId) {
        titleGeneration.cancelFor(activeSessionId);
      }

      clearInlineUserMessageEdit();
    },
    [
      clearInlineUserMessageEdit,
      clearMessages,
      editingUserMessageId,
      editingUserMessageText,
      isRunning,
      messages,
      prepareOutgoingText,
      sendMessage,
      setMessages,
      titleGeneration,
    ]
  );

  const handleRegenerateMessage = useCallback(
    (messageId: string) => {
      const activeSessionId = currentSessionIdRef.current;
      if (activeSessionId) {
        titleGeneration.cancelFor(activeSessionId);
      }
      void regenerate(messageId);
    },
    [regenerate, titleGeneration]
  );

  const handleRetryLastRun = useCallback(() => {
    const activeSessionId = currentSessionIdRef.current;
    if (isRunning || statusAction) {
      return;
    }
    if (activeSessionId) {
      titleGeneration.cancelFor(activeSessionId);
    }
    setStatusAction("retry");
    void retryLastRun().finally(() => setStatusAction(null));
  }, [isRunning, retryLastRun, statusAction, titleGeneration]);

  const handleCompactContext = useCallback(() => {
    const activeSessionId = currentSessionIdRef.current;
    if (!activeSessionId || isRunning || statusAction) {
      return;
    }

    titleGeneration.cancelFor(activeSessionId);
    setStatusAction("compact");
    void pool
      .compact(activeSessionId)
      .catch((error) => {
        console.error("[SidepanelApp] Failed to compact context", error);
      })
      .finally(() => setStatusAction(null));
  }, [isRunning, pool, statusAction, titleGeneration]);

  const handleAttachContext = useCallback(async () => {
    if (contextLoading || attachedPageContext) return;

    setContextLoading(true);
    setContextError(null);
    try {
      const context = await createCurrentPageContextPart();
      setAttachedPageContext(context);
    } catch (error) {
      console.error("[SidepanelApp] Failed to attach tab context", error);
      setContextError(t("sidepanel.error.readTab"));
    } finally {
      setContextLoading(false);
    }
  }, [attachedPageContext, contextLoading, t]);

  const handleDetachContext = useCallback(() => {
    setAttachedPageContext(null);
    setContextError(null);
  }, []);

  useEffect(() => {
    if (!editingUserMessageId) {
      return;
    }

    const editingMessageStillExists = messages.some(
      (message) =>
        message.id === editingUserMessageId && message.role === "user"
    );

    if (!editingMessageStillExists) {
      clearInlineUserMessageEdit();
    }
  }, [clearInlineUserMessageEdit, editingUserMessageId, messages]);

  const sendText = useCallback(
    async (text: string, options?: { includeCurrentPageContext?: boolean }) => {
      const trimmed = text.trim();
      if (
        (!trimmed && attachments.length === 0) ||
        isRunning ||
        attachmentProcessingLabel
      ) {
        return;
      }

      const finalText = prepareOutgoingText(trimmed);

      let messageParts: ChatPart[] = attachments;
      if (options?.includeCurrentPageContext) {
        try {
          const pageContextPart = attachedPageContext
            ? clonePageContextPart(attachedPageContext)
            : await createCurrentPageContextPart();
          messageParts = [pageContextPart, ...attachments];
        } catch (error) {
          console.error(
            "[SidepanelApp] Failed to attach quick action page context",
            error
          );
          setContextError(t("sidepanel.error.readTab"));
          return;
        }
      } else if (attachedPageContext) {
        messageParts = [
          clonePageContextPart(attachedPageContext),
          ...attachments,
        ];
      }

      const sent = sendMessage(finalText, messageParts);
      if (!sent) return;

      clearInlineUserMessageEdit();
      setInputText("");
      setSlashPromptIndex(0);
      resetComposerState();
    },
    [
      attachedPageContext,
      attachments,
      attachmentProcessingLabel,
      isRunning,
      clearInlineUserMessageEdit,
      prepareOutgoingText,
      resetComposerState,
      sendMessage,
      t,
    ]
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void sendText(inputText);
    },
    [inputText, sendText]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputText(event.target.value);
      setSlashPromptIndex(0);
    },
    []
  );

  const handleSlashPromptSelect = useCallback(
    (prompt: SlashPrompt) => {
      const nextInputText = addSlashPromptToInput(prompt, inputText);

      setInputText(nextInputText);
      setSlashPromptIndex(0);
      requestAnimationFrame(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        input.setSelectionRange(nextInputText.length, nextInputText.length);
      });
    },
    [inputText]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (isComposingEnterEvent(event)) {
        return;
      }

      if (inputText.startsWith("/") && filteredPrompts.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSlashPromptIndex((index) => (index + 1) % filteredPrompts.length);
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSlashPromptIndex(
            (index) =>
              (index - 1 + filteredPrompts.length) % filteredPrompts.length
          );
          return;
        }

        if (
          (event.key === "Tab" || event.key === "Enter") &&
          !event.shiftKey &&
          !inputText.includes(" ")
        ) {
          event.preventDefault();
          handleSlashPromptSelect(filteredPrompts[slashPromptIndex]);
          return;
        }
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const form = event.currentTarget.form;
        if (form) {
          form.requestSubmit();
          return;
        }

        void sendText(inputText);
      }
    },
    [
      filteredPrompts,
      handleSlashPromptSelect,
      inputText,
      sendText,
      slashPromptIndex,
    ]
  );

  const openModelSettings = useCallback(() => {
    try {
      const chromeApi = getChromeApi();
      const optionsUrl = chromeApi?.runtime?.getURL?.("options.html");
      if (!optionsUrl) return;

      const url = `${optionsUrl}#ai-providers`;
      if (chromeApi.tabs?.create) {
        chromeApi.tabs.create({ url });
        return;
      }
      chromeApi.runtime?.sendMessage?.({ type: "open_tab", url });
    } catch (error) {
      console.error("[SidepanelApp] Failed to open model settings", error);
    }
  }, []);

  const composerTabContext = useMemo(
    () => pageContextToTabContext(attachedPageContext) || tabContext,
    [attachedPageContext, tabContext]
  );

  if (loading) return <LoadingScreen />;

  if (models.length === 0) {
    return <EmptyProviders onOpenSettings={openModelSettings} />;
  }

  return (
    <div
      className="relative flex h-full overflow-hidden bg-[#f7f3ea] text-[#2f261f]"
      {...dragHandlers}
    >
      <HistoryDrawer
        currentSessionId={currentSessionId}
        onClose={handleCloseHistory}
        onDelete={(id) => void handleDeleteSession(id)}
        onRename={(id, title) => void handleRenameSession(id, title)}
        onSelect={(id) => void handleSelectSession(id)}
        onToggleArchived={(id, archived) =>
          void handleToggleArchived(id, archived)
        }
        onToggleShowArchived={handleToggleShowArchived}
        onTogglePinned={(id, pinned) => void handleTogglePinned(id, pinned)}
        open={historyOpen}
        sessions={sessions}
        showArchived={showArchived}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <div
          ref={messageScrollRef}
          className="relative min-h-0 flex-1 overflow-y-auto"
          onScroll={handleMessageScroll}
        >
          {messages.length === 0 ? (
            <WelcomePane
              disabled={isRunning}
              huntlyMcpEnabled={huntlyMcpEnabled}
              onQuickActionFillComposer={(text) => {
                setInputText(text);
                requestAnimationFrame(() => {
                  const input = inputRef.current;
                  if (!input) return;
                  input.focus();
                  input.setSelectionRange(text.length, text.length);
                });
              }}
              onQuickActionSend={(text, options) => {
                void sendText(text, options);
              }}
              slashPrompts={slashPrompts}
              tabContext={composerTabContext}
            />
          ) : (
            <MessageList
              editingUserMessageId={editingUserMessageId}
              editingUserMessageText={editingUserMessageText}
              endRef={messagesEndRef}
              isRunning={isRunning}
              messages={messages}
              statusAction={statusAction}
              onCancelUserMessageEdit={handleCancelUserMessageEdit}
              onCompactContext={handleCompactContext}
              onEditUserMessage={handleEditUserMessage}
              onEditUserMessageTextChange={handleEditUserMessageTextChange}
              onRegenerate={handleRegenerateMessage}
              onRetryLastRun={handleRetryLastRun}
              onSaveUserMessageEdit={handleSaveUserMessageEdit}
              thinkingMode={thinkingMode}
            />
          )}
        </div>

        <div className="relative shrink-0 bg-[#f7f3ea]/95 px-4 pb-4 pt-3">
          {showScrollToBottom && (
            <div className="pointer-events-none absolute bottom-full right-4 z-10 mb-2">
              <button
                type="button"
                aria-label={t("sidepanel.scrollToBottom")}
                title={t("sidepanel.scrollToBottom")}
                className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d8cfbf] bg-[#fffaf4] text-[#5f5347] shadow-[0_8px_24px_rgba(64,48,31,0.14)] transition-colors hover:bg-[#f4efe6] hover:text-[#2f261f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34020] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f3ea]"
                onClick={() => scrollToBottom("smooth")}
              >
                <ChevronDown className="size-5" />
              </button>
            </div>
          )}
          <Composer
            attachments={attachments}
            attachmentProcessingLabel={attachmentProcessingLabel}
            contextAttached={Boolean(attachedPageContext)}
            contextError={contextError}
            contextLoading={contextLoading}
            currentModelId={currentModelId}
            filteredPrompts={filteredPrompts}
            historyOpen={historyOpen}
            inputRef={inputRef}
            inputText={inputText}
            isRunning={isRunning}
            models={models}
            onAttachContext={handleAttachContext}
            onAttachmentFiles={handleAttachmentFiles}
            onAttachmentRemove={handleAttachmentRemove}
            onCancel={cancelRun}
            onDetachContext={handleDetachContext}
            onInputChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onModelSelect={handleModelSelect}
            onNewChat={handleNewChat}
            onOpenSettings={openModelSettings}
            onSlashPromptSelect={handleSlashPromptSelect}
            onSubmit={handleSubmit}
            onThinkingModeToggle={handleThinkingModeToggle}
            onToggleHistory={handleToggleHistory}
            slashPromptIndex={slashPromptIndex}
            slashPrompts={slashPrompts}
            tabContext={composerTabContext}
            thinkingMode={thinkingMode}
          />
        </div>
      </main>

      {isDraggingOver && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-[#2f261f]/10 backdrop-blur-[1px]">
          <div className="rounded-2xl border-2 border-dashed border-[#a34020] bg-[#fffaf4]/95 px-6 py-4 text-sm font-semibold text-[#a34020] shadow-[0_16px_55px_rgba(64,48,31,0.18)]">
            {t("sidepanel.dropOverlay")}
          </div>
        </div>
      )}
    </div>
  );
};
