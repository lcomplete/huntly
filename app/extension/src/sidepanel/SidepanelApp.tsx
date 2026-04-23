import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import { streamText, type ChatStatus } from "ai";
import { ChevronDown } from "lucide-react";

import {
  buildBaseProviderOptions,
  buildThinkingProviderOptions,
  convertUIMessagesToChatMessages,
  useHuntlyChat,
  type HuntlyUIMessage,
} from "./useHuntlyChat";
import {
  SessionChatPool,
  type SessionChatConfig,
} from "./chatPool";
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
  DEFAULT_SESSION_TITLE,
  deriveSessionTitle,
  getLatestMessage,
  sortSessionMetadataByActivity,
  getStoredLastMessageAt,
  getStoredLastMessageId,
} from "./utils/sessions";
import { useAutosizeTextArea } from "./utils/dom";
import { useSessionPersistence } from "./hooks/useSessionPersistence";
import {
  isScrollPinnedToBottom,
  shouldShowScrollToBottomButton,
} from "./utils/scrollToBottom";
import { Composer } from "./components/Composer";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { MessageList } from "./components/MessageList";
import {
  EmptyProviders,
  LoadingScreen,
  WelcomePane,
} from "./components/Placeholders";
import { useI18n } from "../i18n";

const SCROLL_PIN_THRESHOLD_PX = 96;
const TITLE_MAX_LENGTH = 80;
const DROPPABLE_STRING_TYPES = new Set([
  "text/plain",
  "text/uri-list",
  "text/html",
  "text/x-moz-url",
  "text/x-moz-url-data",
  "DownloadURL",
]);

type PendingSelectionPageContext = {
  title?: string;
  content?: string;
  url?: string;
  faviconUrl?: string;
  description?: string;
  author?: string;
  siteName?: string;
};

type PendingSidepanelContextCommand = {
  id: string;
} & (
  | {
      kind: "image";
      source: string;
    }
  | {
      kind: "page-context";
    }
  | {
      kind: "selection";
      page: PendingSelectionPageContext;
    }
);

function isImageDataUrl(value: string): boolean {
  return /^data:image\//i.test(value.trim());
}

function isPendingSelectionPageContext(
  value: unknown
): value is PendingSelectionPageContext {
  return Boolean(
    value &&
      typeof value === "object" &&
      (typeof (value as PendingSelectionPageContext).content === "string" ||
        typeof (value as PendingSelectionPageContext).content === "undefined")
  );
}

function isPendingSidepanelContextCommand(
  value: unknown
): value is PendingSidepanelContextCommand {
  if (!value || typeof value !== "object") {
    return false;
  }

  const command = value as PendingSidepanelContextCommand;
  if (typeof command.id !== "string" || typeof command.kind !== "string") {
    return false;
  }

  if (command.kind === "image") {
    return typeof command.source === "string";
  }

  if (command.kind === "page-context") {
    return true;
  }

  if (command.kind === "selection") {
    return isPendingSelectionPageContext(command.page);
  }

  return false;
}

function isBlobUrl(value: string): boolean {
  return /^blob:/i.test(value.trim());
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function looksLikeRelativeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;

  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.includes("/") ||
    /\.[a-z0-9]{2,8}(?:[?#].*)?$/i.test(trimmed)
  );
}

function normalizeDroppedSource(
  value: string,
  baseUrl?: string | null
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isHttpUrl(trimmed) || isImageDataUrl(trimmed) || isBlobUrl(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    try {
      return new URL(trimmed, baseUrl || "https://example.com").toString();
    } catch {
      return null;
    }
  }

  if (!baseUrl) return null;
  if (!looksLikeRelativeUrl(trimmed)) return null;

  try {
    const resolved = new URL(trimmed, baseUrl).toString();
    if (isHttpUrl(resolved) || isImageDataUrl(resolved) || isBlobUrl(resolved)) {
      return resolved;
    }
  } catch {
    return null;
  }

  return null;
}

function collectUrlsFromSrcset(value: string, baseUrl?: string | null): string[] {
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0] || "")
    .map((candidate) => normalizeDroppedSource(candidate, baseUrl))
    .filter((candidate): candidate is string => Boolean(candidate));
}

function collectUrlsFromText(value: string, baseUrl?: string | null): string[] {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => normalizeDroppedSource(entry, baseUrl))
    .filter((entry): entry is string => Boolean(entry));
}

function collectUrlsFromDownloadUrl(
  value: string,
  baseUrl?: string | null
): string[] {
  const match = value.match(/^[^:]+:[^:]*:(.+)$/);
  if (!match?.[1]) return [];

  const normalized = normalizeDroppedSource(match[1], baseUrl);
  return normalized ? [normalized] : [];
}

function collectImageSourcesFromHtml(
  html: string,
  baseUrl?: string | null
): string[] {
  const sources = new Set<string>();

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const nodes = doc.querySelectorAll("img, source");

    nodes.forEach((node) => {
      const src = node.getAttribute("src");
      const srcset = node.getAttribute("srcset");

      const normalizedSrc = src ? normalizeDroppedSource(src, baseUrl) : null;
      if (normalizedSrc) {
        sources.add(normalizedSrc);
      }

      if (srcset) {
        collectUrlsFromSrcset(srcset, baseUrl).forEach((value) =>
          sources.add(value)
        );
      }
    });
  } catch {
    // Ignore malformed HTML payloads from drag-and-drop.
  }

  return Array.from(sources);
}

function readDragItemAsString(item: DataTransferItem): Promise<string> {
  return new Promise((resolve) => {
    item.getAsString((value) => resolve(value || ""));
  });
}

function dedupeFiles(files: File[]): File[] {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = [file.name, file.size, file.type, file.lastModified].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isComposingEnterEvent(
  event: React.KeyboardEvent<HTMLTextAreaElement>
): boolean {
  if (event.key !== "Enter") return false;

  const nativeEvent = event.nativeEvent as KeyboardEvent & {
    isComposing?: boolean;
    keyCode?: number;
  };

  return (
    nativeEvent.isComposing === true ||
    nativeEvent.keyCode === 229
  );
}

async function extractDroppedPayload(
  dataTransfer: DataTransfer,
  baseUrl?: string | null
): Promise<{
  files: File[];
  sources: string[];
}> {
  const items = Array.from(dataTransfer.items || []);
  const filesFromItems = dedupeFiles(
    items
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
  );

  const files =
    filesFromItems.length > 0
      ? filesFromItems
      : dedupeFiles(Array.from(dataTransfer.files || []));

  const stringItems = await Promise.all(
    items
      .filter(
        (item) =>
          item.kind === "string" && DROPPABLE_STRING_TYPES.has(item.type)
      )
      .map(async (item) => ({
        type: item.type,
        value: (await readDragItemAsString(item)).trim(),
      }))
  );

  const sources = new Set<string>();

  for (const item of stringItems) {
    if (!item.value) continue;

    if (item.type === "text/html") {
      collectImageSourcesFromHtml(item.value, baseUrl).forEach((value) =>
        sources.add(value)
      );
      continue;
    }

    if (item.type === "DownloadURL") {
      collectUrlsFromDownloadUrl(item.value, baseUrl).forEach((value) =>
        sources.add(value)
      );
      continue;
    }

    collectUrlsFromText(item.value, baseUrl).forEach((value) =>
      sources.add(value)
    );
  }

  collectUrlsFromText(dataTransfer.getData("text/uri-list"), baseUrl).forEach(
    (value) => sources.add(value)
  );
  collectImageSourcesFromHtml(dataTransfer.getData("text/html"), baseUrl).forEach(
    (value) => sources.add(value)
  );
  collectUrlsFromText(dataTransfer.getData("text/plain"), baseUrl).forEach(
    (value) => sources.add(value)
  );
  collectUrlsFromText(dataTransfer.getData("text/x-moz-url"), baseUrl).forEach(
    (value) => sources.add(value)
  );
  collectUrlsFromDownloadUrl(dataTransfer.getData("DownloadURL"), baseUrl).forEach(
    (value) => sources.add(value)
  );

  return {
    files,
    sources: Array.from(sources),
  };
}

function summarizeFirstUserMessageForTitle(parts: ChatPart[]): string {
  const segments: string[] = [];
  const text = getDisplayMessageText(parts).replace(/\s+/g, " ").trim();

  if (text) {
    segments.push(text);
  }

  for (const part of parts) {
    if (part.type === "page-context") {
      const label = (part.articleTitle || part.title || part.url || "").trim();
      if (label) {
        segments.push(`Attached page: ${label}`);
      }
      continue;
    }

    if (part.type === "file") {
      const label = (part.filename || part.mediaType || "attachment").trim();
      if (label) {
        segments.push(`Attachment: ${label}`);
      }
    }
  }

  return segments.join(" | ");
}

function normalizeGeneratedSessionTitle(value: string): string | null {
  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return null;

  const normalized = firstLine
    .replace(/^[#>*\-\d.\s]*(?:title|conversation title)\s*:\s*/i, "")
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.。]+$/, "")
    .trim();

  if (!normalized || normalized === DEFAULT_SESSION_TITLE) {
    return null;
  }

  return normalized.length <= TITLE_MAX_LENGTH
    ? normalized
    : `${normalized.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

async function generateSessionTitleFromFirstMessage(
  message: ChatMessage,
  modelInfo: HuntlyModelInfo,
  systemPrompt: string,
  thinkingEnabled = false,
  abortSignal?: AbortSignal
): Promise<string | null> {
  const source = summarizeFirstUserMessageForTitle(message.parts);
  if (!source) {
    console.warn("[SidepanelApp] Title generation skipped: empty first user message");
    return null;
  }

  let streamError: unknown = null;
  const result = streamText({
    model: modelInfo.model as any,
    system: systemPrompt,
    prompt:
      `First user message:\n\n${source}\n\n` +
      "Generate one short conversation title based only on this first user message. Output only the title.",
    maxOutputTokens: 128,
    abortSignal,
    providerOptions: thinkingEnabled
      ? buildThinkingProviderOptions(modelInfo.provider)
      : buildBaseProviderOptions(modelInfo.provider),
    onError({ error }) {
      streamError = error;
    },
  });

  const generatedText = await result.text;
  if (streamError) {
    throw streamError;
  }

  return normalizeGeneratedSessionTitle(generatedText);
}

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
  const [tabContext, setTabContext] = useState<TabContext | null>(null);
  const [attachedPageContext, setAttachedPageContext] =
    useState<ChatPart | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [editingUserMessageId, setEditingUserMessageId] = useState<string | null>(null);
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
  const titleGenerationAbortsRef = useRef<Map<string, AbortController>>(
    new Map()
  );
  const titleGenerationKeysRef = useRef<Map<string, string>>(new Map());
  const titleGenerationSystemPromptRef = useRef(
    buildSidepanelTitleGenerationSystemPrompt("English")
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageScrollPinnedRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const persistence = useSessionPersistence();

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

  const cancelTitleGenerationFor = useCallback((sessionId: string) => {
    titleGenerationAbortsRef.current.get(sessionId)?.abort();
    titleGenerationAbortsRef.current.delete(sessionId);
    titleGenerationKeysRef.current.delete(sessionId);
  }, []);

  const cancelAllTitleGenerations = useCallback(() => {
    for (const controller of titleGenerationAbortsRef.current.values()) {
      controller.abort();
    }
    titleGenerationAbortsRef.current.clear();
    titleGenerationKeysRef.current.clear();
  }, []);

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
      cancelTitleGenerationFor(sessionId);
    },
    [cancelTitleGenerationFor, pool]
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

  const maybeGenerateSessionTitle = useCallback(
    (session: SessionData, chatMessages: ChatMessage[]) => {
      const currentModel = currentModelRef.current;
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
      if (titleGenerationKeysRef.current.get(sessionId) === requestKey) {
        return;
      }

      // Cancel any previous attempt for this session (different first message
      // — e.g. edited-first-message path) and start fresh. Do NOT touch other
      // sessions' title generation runs, so parallel conversations can each
      // generate their own title independently.
      cancelTitleGenerationFor(sessionId);

      const controller = new AbortController();
      titleGenerationAbortsRef.current.set(sessionId, controller);
      titleGenerationKeysRef.current.set(sessionId, requestKey);

      const applyTitleResult = (
        title: string | null,
        reason: "llm" | "fallback"
      ) => {
        const currentSession = sessionsDataRef.current.get(sessionId);
        if (!currentSession) {
          return;
        }

        const currentFirstUserMessage = currentSession.messages.find(
          (message) => message.role === "user"
        );
        const activeRequestKey = currentFirstUserMessage
          ? `${currentSession.id}:${currentFirstUserMessage.id || "first-user"}`
          : null;

        if (activeRequestKey !== requestKey) {
          return;
        }

        const resolvedTitle =
          title ||
          deriveSessionTitle(currentSession.messages, DEFAULT_SESSION_TITLE);
        if (!resolvedTitle || resolvedTitle === DEFAULT_SESSION_TITLE) {
          syncSessionSnapshot(
            {
              ...currentSession,
              titleGenerationStatus: "failed",
              titleGeneratedAt: undefined,
            },
            true
          );
          return;
        }

        syncSessionSnapshot(
          {
            ...currentSession,
            title: resolvedTitle,
            titleGenerationStatus: "generated",
            titleGeneratedAt: new Date().toISOString(),
          },
          true
        );
        console.debug("[SidepanelApp] Title generation: applying title", {
          sessionId,
          reason,
          title: resolvedTitle,
        });
      };

      void (async () => {
        let generatedTitle: string | null = null;

        try {
          generatedTitle = await generateSessionTitleFromFirstMessage(
            firstUserMessage,
            currentModel,
            titleGenerationSystemPromptRef.current,
            false,
            controller.signal
          );
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error(
              "[SidepanelApp] Title generation failed without thinking",
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
              titleGenerationSystemPromptRef.current,
              true,
              controller.signal
            );
          } catch (error) {
            if (!controller.signal.aborted) {
              console.error(
                "[SidepanelApp] Title generation retry failed with thinking",
                error
              );
            }
          }
        }

        if (controller.signal.aborted) {
          return;
        }

        applyTitleResult(generatedTitle, generatedTitle ? "llm" : "fallback");
      })().finally(() => {
        if (titleGenerationAbortsRef.current.get(sessionId) === controller) {
          titleGenerationAbortsRef.current.delete(sessionId);
        }
        if (titleGenerationKeysRef.current.get(sessionId) === requestKey) {
          titleGenerationKeysRef.current.delete(sessionId);
        }
      });
    },
    [cancelTitleGenerationFor, syncSessionSnapshot]
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
    (sessionId: string, chatMessages: ChatMessage[]) => {
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

      if (!latestChanged) {
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

      const updated: SessionData = {
        ...session,
        title: (session.title || "").trim() || DEFAULT_SESSION_TITLE,
        titleGenerationStatus:
          session.titleGenerationStatus === "generated"
            ? "generated"
            : "idle",
        titleGeneratedAt:
          session.titleGenerationStatus === "generated"
            ? session.titleGeneratedAt
            : undefined,
        currentModelId: isActiveSession
          ? activeModelKey
          : session.currentModelId,
        thinkingEnabled: isActiveSession
          ? thinkingModeRef.current
          : session.thinkingEnabled,
        messages: chatMessages,
        updatedAt: now,
        lastMessageAt: now,
        lastMessageId: latestMessage?.id || prevLatestId,
        lastOpenedAt: isActiveSession
          ? now
          : session.lastOpenedAt || session.updatedAt || session.createdAt,
      };

      syncSessionSnapshot(updated, !isStreaming);

      // Title generation is off the hot path: only fire once streaming
      // settles (or when not streaming at all). The inner dedupe still
      // short-circuits if the title is already generated.
      if (!isStreaming) {
        maybeGenerateSessionTitle(updated, chatMessages);
      }
    },
    [maybeGenerateSessionTitle, syncSessionSnapshot]
  );

  // Pool event handler converts the AI SDK UI snapshot into our local
  // ChatMessage shape and feeds the per-session messages handler. Stored as
  // a ref so updating its closure does not require recreating the pool.
  useEffect(() => {
    poolEventHandlerRef.current = (sessionId, snapshot) => {
      const previous =
        previousSessionMessagesRef.current.get(sessionId) || [];
      const chatMessages = convertUIMessagesToChatMessages(
        snapshot.messages,
        snapshot.status,
        snapshot.error,
        previous
      );
      previousSessionMessagesRef.current.set(sessionId, chatMessages);
      handleSessionMessagesChange(sessionId, chatMessages);
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
    cancelRun,
    setMessages,
    clearMessages,
  } = chat;

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
        tab,
        loadedSystemPrompt,
        loadedTitleGenerationSystemPrompt,
      ] = await Promise.all([
        loadModels(),
        loadSlashPrompts(),
        getSidepanelSelectedModelId(),
        getSidepanelThinkingModeEnabled(),
        getTabContext(),
        loadSidepanelSystemPrompt(),
        loadSidepanelTitleGenerationSystemPrompt(),
      ]);
      if (cancelled) return;

      setModels(availableModels);
      setSlashPrompts(prompts);
      setThinkingMode(savedThinkingMode);
      setTabContext(tab);
      setSystemPrompt(loadedSystemPrompt);
      setTitleGenerationSystemPrompt(loadedTitleGenerationSystemPrompt);

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
      const [
        updatedModels,
        updatedPrompts,
        updatedSystemPrompt,
        updatedTitleGenerationSystemPrompt,
      ] =
        await Promise.all([
          loadModels(),
          loadSlashPrompts(),
          loadSidepanelSystemPrompt(),
          loadSidepanelTitleGenerationSystemPrompt(),
        ]);
      setModels(updatedModels);
      setSlashPrompts(updatedPrompts);
      setSystemPrompt(updatedSystemPrompt);
      setTitleGenerationSystemPrompt(updatedTitleGenerationSystemPrompt);
    });
    return unsubscribe;
  }, []);

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
      cancelAllTitleGenerations();
      pool.disposeAll();
    };
  }, [cancelAllTitleGenerations, persistence, pool]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messageScrollPinnedRef.current = true;
    setShowScrollToBottom(false);
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior });
  }, []);

  const handleMessageScroll = useCallback(() => {
    const scrollContainer = messageScrollRef.current;
    if (!scrollContainer) return;

    const distanceToBottom =
      scrollContainer.scrollHeight -
      scrollContainer.scrollTop -
      scrollContainer.clientHeight;
    const pinned = isScrollPinnedToBottom(
      distanceToBottom,
      SCROLL_PIN_THRESHOLD_PX
    );

    messageScrollPinnedRef.current = pinned;
    setShowScrollToBottom(
      shouldShowScrollToBottomButton(messages.length, pinned)
    );
  }, [messages.length]);

  useEffect(() => {
    if (messages.length === 0) {
      messageScrollPinnedRef.current = true;
      setShowScrollToBottom(false);
      return;
    }

    if (!messageScrollPinnedRef.current) {
      setShowScrollToBottom(
        shouldShowScrollToBottomButton(messages.length, false)
      );
      return;
    }

    const frame = window.requestAnimationFrame(() => scrollToBottom("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [messages, scrollToBottom]);

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
      cancelTitleGenerationFor(id);
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
      cancelTitleGenerationFor,
      clearInlineUserMessageEdit,
      persistence,
      pool,
      resetComposerState,
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
          pool.ensure(id, chatMessages);
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
        maybeGenerateSessionTitle(finalSession, chatMessages);
      } catch (error) {
        console.error("[SidepanelApp] Failed to open session", error);
      }
    },
    [
      clearInlineUserMessageEdit,
      maybeGenerateSessionTitle,
      persistence,
      pool,
      pruneEmptyDraft,
      resetComposerState,
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

      setAttachmentProcessingLabel(
        t("sidepanel.processing.chatContext")
      );

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
              console.error("[SidepanelApp] Failed to attach page context", error);
              setContextError(t("sidepanel.error.readTab"));
            }
            continue;
          }

          try {
            const part = createPageContextPart(command.page, {
              title: command.page.title || t("sidepanel.context.selectedContent"),
              url: command.page.url,
              faviconUrl: command.page.faviconUrl,
            });
            setAttachedPageContext(part);
            setContextError(null);
            completedIds.push(command.id);
          } catch (error) {
            console.error("[SidepanelApp] Failed to attach selection context", error);
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

  // Keep the latest append callback in a ref so the runtime message listener
  // below can stay mount-once. Re-subscribing the listener on every render
  // re-invoked `consume_pending_sidepanel_context_commands`, which
  // double-consumed pending commands from the background page.
  const appendPendingContextCommandsRef = useRef(appendPendingContextCommands);
  useEffect(() => {
    appendPendingContextCommandsRef.current = appendPendingContextCommands;
  }, [appendPendingContextCommands]);

  useEffect(() => {
    let cancelled = false;

    const handleRuntimeMessage = (
      message: unknown,
      _sender: unknown,
      sendResponse: (response?: unknown) => void
    ) => {
      const typedMessage = message as
        | {
            type?: string;
            payload?: { command?: unknown };
          }
        | undefined;
      if (typedMessage?.type !== "sidepanel_context_menu_command") {
        return undefined;
      }

      const command = typedMessage.payload?.command;
      if (!isPendingSidepanelContextCommand(command)) {
        sendResponse({
          success: false,
          error: "Invalid sidepanel context command.",
        });
        return undefined;
      }

      void appendPendingContextCommandsRef.current([command])
        .then((completedIds) => {
          const completed = completedIds.includes(command.id);
          sendResponse({
            success: completed,
            commandId: completed ? command.id : null,
          });
        })
        .catch((error) => {
          console.error("[SidepanelApp] Failed to handle context menu command", error);
          sendResponse({
            success: false,
            error: (error as Error)?.message || "Failed to process command",
          });
        });

      return true;
    };

    const consumePendingContextCommands = async () => {
      try {
        const currentWindow = await chrome.windows.getCurrent();
        if (cancelled || typeof currentWindow.id !== "number") {
          return;
        }

        const response = (await chrome.runtime.sendMessage({
          type: "consume_pending_sidepanel_context_commands",
          payload: {
            windowId: currentWindow.id,
          },
        })) as unknown as { commands?: unknown } | undefined;
        const pendingCommands = Array.isArray(response?.commands)
          ? response.commands.filter(isPendingSidepanelContextCommand)
          : [];

        if (!cancelled && pendingCommands.length > 0) {
          await appendPendingContextCommandsRef.current(pendingCommands);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "[SidepanelApp] Failed to consume pending sidepanel commands",
            error
          );
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    void consumePendingContextCommands();

    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, []);

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragDepthRef = useRef(0);
  const internalDragRef = useRef(false);

  const hasFilesOrUrl = useCallback((event: React.DragEvent) => {
    if (internalDragRef.current) {
      return false;
    }

    const items = Array.from(event.dataTransfer?.items || []);
    if (items.length > 0) {
      return items.some(
        (item) =>
          item.kind === "file" ||
          (item.kind === "string" && DROPPABLE_STRING_TYPES.has(item.type))
      );
    }

    return Array.from(event.dataTransfer?.types || []).some(
      (type) => type === "Files" || DROPPABLE_STRING_TYPES.has(type)
    );
  }, []);

  const handleDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!hasFilesOrUrl(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDraggingOver(true);
    },
    [hasFilesOrUrl]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!hasFilesOrUrl(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    [hasFilesOrUrl]
  );

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!hasFilesOrUrl(event)) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDraggingOver(false);
    },
    [hasFilesOrUrl]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!hasFilesOrUrl(event)) return;
      event.preventDefault();
      internalDragRef.current = false;
      dragDepthRef.current = 0;
      setIsDraggingOver(false);

      const dataTransfer = event.dataTransfer;

      void (async () => {
        const { files, sources } = await extractDroppedPayload(
          dataTransfer,
          tabContext?.url
        );

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
      })().catch((error) => {
        console.error("[SidepanelApp] Failed to handle drop", error);
      }).finally(() => {
        setAttachmentProcessingLabel(null);
      });
    },
    [addAttachmentFromSource, attachFiles, hasFilesOrUrl, t, tabContext?.url]
  );

  const handleInternalDragStartCapture = useCallback(() => {
    internalDragRef.current = true;
  }, []);

  const handleInternalDragEndCapture = useCallback(() => {
    internalDragRef.current = false;
    dragDepthRef.current = 0;
    setIsDraggingOver(false);
  }, []);

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
        cancelTitleGenerationFor(activeSessionId);
      }

      clearInlineUserMessageEdit();
    },
    [
      cancelTitleGenerationFor,
      clearInlineUserMessageEdit,
      clearMessages,
      editingUserMessageId,
      editingUserMessageText,
      isRunning,
      messages,
      prepareOutgoingText,
      sendMessage,
      setMessages,
    ]
  );

  const handleRegenerateMessage = useCallback(
    (messageId: string) => {
      const activeSessionId = currentSessionIdRef.current;
      if (activeSessionId) {
        cancelTitleGenerationFor(activeSessionId);
      }
      void regenerate(messageId);
    },
    [cancelTitleGenerationFor, regenerate]
  );

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
    async (
      text: string,
      options?: { includeCurrentPageContext?: boolean }
    ) => {
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
        messageParts = [clonePageContextPart(attachedPageContext), ...attachments];
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
    <div
      className="relative flex h-full overflow-hidden bg-[#f7f3ea] text-[#2f261f]"
      onDragEndCapture={handleInternalDragEndCapture}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragStartCapture={handleInternalDragStartCapture}
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
              onCancelUserMessageEdit={handleCancelUserMessageEdit}
              onEditUserMessage={handleEditUserMessage}
              onEditUserMessageTextChange={handleEditUserMessageTextChange}
              onRegenerate={handleRegenerateMessage}
              onSaveUserMessageEdit={handleSaveUserMessageEdit}
              thinkingMode={thinkingMode}
            />
          )}
        </div>

        <div className="shrink-0 bg-[#f7f3ea]/95 px-4 pb-4 pt-3">
          {showScrollToBottom && (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                aria-label={t("sidepanel.scrollToBottom")}
                title={t("sidepanel.scrollToBottom")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d8cfbf] bg-[#fffaf4] text-[#5f5347] shadow-[0_8px_24px_rgba(64,48,31,0.14)] transition-colors hover:bg-[#f4efe6] hover:text-[#2f261f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34020] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f3ea]"
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
