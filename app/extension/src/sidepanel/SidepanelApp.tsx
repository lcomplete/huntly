import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import { ChevronDown } from "lucide-react";

import { useHuntlyChat } from "./useHuntlyChat";
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
  createEmptySession,
  deleteSession,
  getSession,
  listSessionMetadata,
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
  saveSidepanelSelectedModelId,
  saveSidepanelThinkingModeEnabled,
} from "../storage";
import {
  buildSidepanelSystemPrompt,
  loadSidepanelSystemPrompt,
} from "./systemPrompt";
import { loadModels } from "./utils/loadModels";
import {
  clonePageContextPart,
  createAttachmentPart,
  createCurrentPageContextPart,
  getTabContext,
  onConfigChange,
  pageContextToTabContext,
  type TabContext,
} from "./utils/tabContext";
import { generateId } from "./utils/ids";
import {
  addSlashPromptToInput,
  getDisplayMessageText,
} from "./utils/messageParts";
import {
  getLatestMessage,
  getStoredLastMessageAt,
  getStoredLastMessageId,
} from "./utils/sessions";
import { useAutosizeTextArea } from "./utils/dom";
import { useSessionPersistence } from "./hooks/useSessionPersistence";
import { Composer } from "./components/Composer";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { MessageList } from "./components/MessageList";
import {
  EmptyProviders,
  LoadingScreen,
  WelcomePane,
} from "./components/Placeholders";

const SCROLL_PIN_THRESHOLD_PX = 96;
const TITLE_MAX_LENGTH = 60;

export const SidepanelApp: FC = () => {
  const [models, setModels] = useState<HuntlyModelInfo[]>([]);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [slashPrompts, setSlashPrompts] = useState<SlashPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [tabContext, setTabContext] = useState<TabContext | null>(null);
  const [attachedPageContext, setAttachedPageContext] =
    useState<ChatPart | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [attachments, setAttachments] = useState<ChatPart[]>([]);
  const [slashPromptIndex, setSlashPromptIndex] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState(() =>
    buildSidepanelSystemPrompt("English")
  );

  const currentModelRef = useRef<HuntlyModelInfo | null>(null);
  const thinkingModeRef = useRef(false);
  const sessionRef = useRef<SessionData | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const skipNextMessagesPersistRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageScrollPinnedRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const persistence = useSessionPersistence();

  useAutosizeTextArea(inputRef, inputText);

  useEffect(() => {
    currentModelRef.current = findModelByKey(models, currentModelId);
  }, [models, currentModelId]);

  useEffect(() => {
    thinkingModeRef.current = thinkingMode;
  }, [thinkingMode]);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await listSessionMetadata());
    } catch (error) {
      console.error("[SidepanelApp] Failed to list sessions", error);
      setSessions([]);
    }
  }, []);

  const handleMessagesChange = useCallback(
    (chatMessages: ChatMessage[]) => {
      if (skipNextMessagesPersistRef.current) {
        skipNextMessagesPersistRef.current = false;
        return;
      }

      if (chatMessages.length === 0) return;

      let session = sessionRef.current;
      if (!session) {
        session = createEmptySession(
          currentModelRef.current ? getModelKey(currentModelRef.current) : null
        );
        sessionRef.current = session;
        currentSessionIdRef.current = session.id;
        setCurrentSessionId(session.id);
      }

      let title = session.title;
      const firstUserMsg = chatMessages.find(
        (message) => message.role === "user"
      );
      if (firstUserMsg && title === "New chat") {
        const textParts = getDisplayMessageText(firstUserMsg.parts)
          .replace(/\s+/g, " ")
          .trim();
        if (textParts) {
          title =
            textParts.length <= TITLE_MAX_LENGTH
              ? textParts
              : `${textParts.slice(0, TITLE_MAX_LENGTH - 3)}...`;
        }
      }

      const now = new Date().toISOString();
      const latestMessage = getLatestMessage(chatMessages);

      const updated: SessionData = {
        ...session,
        title,
        currentModelId: currentModelRef.current
          ? getModelKey(currentModelRef.current)
          : null,
        thinkingEnabled: thinkingModeRef.current,
        messages: chatMessages,
        updatedAt: now,
        lastMessageAt: latestMessage ? now : getStoredLastMessageAt(session),
        lastMessageId: latestMessage?.id || getStoredLastMessageId(session),
        lastOpenedAt:
          currentSessionIdRef.current === session.id
            ? now
            : session.lastOpenedAt || session.updatedAt || session.createdAt,
      };

      sessionRef.current = updated;
      persistence.persist(updated, latestMessage?.status !== "running");
    },
    [persistence]
  );

  const chat = useHuntlyChat({
    getModelInfo: () => currentModelRef.current,
    getThinkingMode: () => thinkingModeRef.current,
    systemPrompt,
    onMessagesChange: handleMessagesChange,
  });

  const {
    messages,
    isRunning,
    sendMessage,
    regenerate,
    cancelRun,
    setMessages,
    clearMessages,
  } = chat;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [
        availableModels,
        prompts,
        savedModelId,
        savedThinkingMode,
        tab,
        loadedSystemPrompt,
      ] = await Promise.all([
        loadModels(),
        loadSlashPrompts(),
        getSidepanelSelectedModelId(),
        getSidepanelThinkingModeEnabled(),
        getTabContext(),
        loadSidepanelSystemPrompt(),
      ]);
      if (cancelled) return;

      setModels(availableModels);
      setSlashPrompts(prompts);
      setThinkingMode(savedThinkingMode);
      setTabContext(tab);
      setSystemPrompt(loadedSystemPrompt);

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
    if (attachedPageContext) return;

    let cancelled = false;
    const refresh = async () => {
      const nextTabContext = await getTabContext();
      if (!cancelled) {
        setTabContext(nextTabContext);
        setContextError(null);
      }
    };

    const handleActivated = () => void refresh();
    const handleUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (
        tab.active &&
        (changeInfo.title || changeInfo.url || changeInfo.status === "complete")
      ) {
        void refresh();
      }
    };
    const handleFocusChanged = (windowId: number) => {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) void refresh();
    };

    void refresh();
    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);
    chrome.windows.onFocusChanged.addListener(handleFocusChanged);

    return () => {
      cancelled = true;
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      chrome.windows.onFocusChanged.removeListener(handleFocusChanged);
    };
  }, [attachedPageContext]);

  useEffect(() => {
    const unsubscribe = onConfigChange(async () => {
      const [updatedModels, updatedPrompts, updatedSystemPrompt] =
        await Promise.all([
          loadModels(),
          loadSlashPrompts(),
          loadSidepanelSystemPrompt(),
        ]);
      setModels(updatedModels);
      setSlashPrompts(updatedPrompts);
      setSystemPrompt(updatedSystemPrompt);
    });
    return unsubscribe;
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    messageScrollPinnedRef.current = true;
    setShowJumpToLatest(false);
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior });
  }, []);

  const handleMessageScroll = useCallback(() => {
    const scrollContainer = messageScrollRef.current;
    if (!scrollContainer) return;

    const distanceToBottom =
      scrollContainer.scrollHeight -
      scrollContainer.scrollTop -
      scrollContainer.clientHeight;
    const pinned = distanceToBottom < SCROLL_PIN_THRESHOLD_PX;

    messageScrollPinnedRef.current = pinned;
    setShowJumpToLatest(!pinned && messages.length > 0 && isRunning);
  }, [isRunning, messages.length]);

  useEffect(() => {
    if (messages.length === 0) {
      messageScrollPinnedRef.current = true;
      setShowJumpToLatest(false);
      return;
    }

    if (!messageScrollPinnedRef.current) {
      setShowJumpToLatest(true);
      return;
    }

    const frame = window.requestAnimationFrame(() => scrollToLatest("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [messages, isRunning, scrollToLatest]);

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

  const resetComposerState = useCallback(() => {
    setAttachedPageContext(null);
    setContextError(null);
    setAttachments([]);
  }, []);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      persistence.markDeleted(id);

      if (currentSessionIdRef.current === id) {
        cancelRun({ discard: true });
      }

      await deleteSession(id);
      setSessions((previous) =>
        previous.filter((session) => session.id !== id)
      );
      if (currentSessionIdRef.current === id) {
        sessionRef.current = null;
        currentSessionIdRef.current = null;
        setCurrentSessionId(null);
        resetComposerState();
        clearMessages();
      }
    },
    [cancelRun, clearMessages, persistence, resetComposerState]
  );

  const handleSelectSession = useCallback(
    async (id: string) => {
      try {
        cancelRun({ discard: true });
        persistence.flush();

        const session = await getSession(id);
        if (!session) return;

        const storedMessages = session.messages || [];
        const chatMessages: ChatMessage[] = storedMessages.map((message) => ({
          id: message.id || generateId(),
          role: message.role,
          parts: message.parts || [],
          status: message.status || "complete",
        }));
        const latestMessage = getLatestMessage(chatMessages);
        const openedAt = new Date().toISOString();
        const openedSession: SessionData = {
          ...session,
          messages: chatMessages,
          lastMessageAt:
            getStoredLastMessageAt(session) ||
            (latestMessage ? session.updatedAt : undefined),
          lastMessageId: getStoredLastMessageId(session) || latestMessage?.id,
          lastOpenedAt: openedAt,
        };

        sessionRef.current = openedSession;
        currentSessionIdRef.current = openedSession.id;
        setCurrentSessionId(openedSession.id);

        skipNextMessagesPersistRef.current = true;
        if (chatMessages.length > 0) {
          setMessages(chatMessages);
        } else {
          clearMessages();
        }

        resetComposerState();
        setHistoryOpen(false);
        persistence.persist(openedSession, true);
      } catch (error) {
        console.error("[SidepanelApp] Failed to open session", error);
      }
    },
    [cancelRun, clearMessages, persistence, resetComposerState, setMessages]
  );

  const handleNewChat = useCallback(() => {
    cancelRun({ discard: true });
    persistence.cancelPending();
    sessionRef.current = null;
    currentSessionIdRef.current = null;
    setCurrentSessionId(null);
    setHistoryOpen(false);
    setInputText("");
    setSlashPromptIndex(0);
    resetComposerState();
    clearMessages();
    inputRef.current?.focus();
  }, [cancelRun, clearMessages, persistence, resetComposerState]);

  const handleThinkingModeToggle = useCallback(() => {
    setThinkingMode((previous) => {
      const next = !previous;
      void saveSidepanelThinkingModeEnabled(next);
      return next;
    });
  }, []);

  const handleAttachmentFiles = useCallback((files: FileList) => {
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) return;

    void Promise.all(selectedFiles.map(createAttachmentPart))
      .then((parts) => {
        setAttachments((previous) => [...previous, ...parts]);
      })
      .catch((error) => {
        console.error("[SidepanelApp] Failed to read attachment", error);
      });
  }, []);

  const handleAttachmentRemove = useCallback((id: string) => {
    setAttachments((previous) => previous.filter((part) => part.id !== id));
  }, []);

  const handleAttachContext = useCallback(async () => {
    if (contextLoading || attachedPageContext) return;

    setContextLoading(true);
    setContextError(null);
    try {
      const context = await createCurrentPageContextPart();
      setAttachedPageContext(context);
    } catch (error) {
      console.error("[SidepanelApp] Failed to attach tab context", error);
      setContextError("Unable to read this tab");
    } finally {
      setContextLoading(false);
    }
  }, [attachedPageContext, contextLoading]);

  const handleDetachContext = useCallback(() => {
    setAttachedPageContext(null);
    setContextError(null);
  }, []);

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if ((!trimmed && attachments.length === 0) || isRunning) return;

      let finalText = trimmed;
      if (trimmed) {
        const parsed = parsePromptInput(trimmed, slashPrompts);
        finalText = parsed.prompt ? composePromptMessage(parsed) : trimmed;
      }

      const messageParts = attachedPageContext
        ? [clonePageContextPart(attachedPageContext), ...attachments]
        : attachments;
      const sent = sendMessage(finalText, messageParts);
      if (!sent) return;

      setInputText("");
      setSlashPromptIndex(0);
      resetComposerState();
    },
    [
      attachedPageContext,
      attachments,
      isRunning,
      resetComposerState,
      sendMessage,
      slashPrompts,
    ]
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      sendText(inputText);
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
        sendText(inputText);
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
      const optionsUrl = chrome.runtime.getURL("options.html");
      const url = `${optionsUrl}#ai-providers`;
      if (chrome.tabs?.create) {
        chrome.tabs.create({ url });
        return;
      }
      chrome.runtime.sendMessage({ type: "open_tab", url });
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
    <div className="relative flex h-full overflow-hidden bg-[#f7f3ea] text-[#2f261f]">
      <HistoryDrawer
        currentSessionId={currentSessionId}
        onClose={handleCloseHistory}
        onDelete={(id) => void handleDeleteSession(id)}
        onSelect={(id) => void handleSelectSession(id)}
        open={historyOpen}
        sessions={sessions}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <div
          ref={messageScrollRef}
          className="relative min-h-0 flex-1 overflow-y-auto"
          onScroll={handleMessageScroll}
        >
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-5">
              <WelcomePane />
            </div>
          ) : (
            <MessageList
              endRef={messagesEndRef}
              isRunning={isRunning}
              messages={messages}
              onRegenerate={regenerate}
              thinkingMode={thinkingMode}
            />
          )}
        </div>

        <div className="shrink-0 bg-[#f7f3ea]/95 px-4 pb-4 pt-3">
          {showJumpToLatest && (
            <div className="mb-2 flex justify-center">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#d8cfbf] bg-[#fffaf4] px-3 py-1.5 text-xs font-semibold text-[#5f5347] shadow-[0_8px_24px_rgba(64,48,31,0.14)] transition-colors hover:bg-[#f4efe6] hover:text-[#2f261f]"
                onClick={() => scrollToLatest("smooth")}
              >
                <ChevronDown className="size-4" />
                Jump to latest
              </button>
            </div>
          )}
          <Composer
            attachments={attachments}
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
    </div>
  );
};
