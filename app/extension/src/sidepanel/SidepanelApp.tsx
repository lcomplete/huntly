import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FC,
} from "react";
import Tooltip from "@mui/material/Tooltip";
import moment from "moment";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TurndownService from "turndown";
import {
  AlertTriangle,
  ArrowUp,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Paperclip,
  History,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  SquarePen,
  Search,
  Settings,
  Sparkles,
  Square,
  Trash,
  Wrench,
  X,
} from "lucide-react";

import { useHuntlyChat } from "./useHuntlyChat";
import type {
  ChatMessage,
  ChatPart,
  HuntlyModelInfo,
  SessionData,
  SessionMetadata,
  SlashPrompt,
} from "./types";
import { createLanguageModel } from "./modelBridge";
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
  saveSession,
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
import { getAIProvidersStorage } from "../ai/storage";
import { PROVIDER_ORDER, PROVIDER_REGISTRY } from "../ai/types";
import type { AIProviderConfig, ProviderType } from "../ai/types";

const SIDEPANEL_SYSTEM_PROMPT = `You are Huntly AI, an intelligent assistant embedded in the Huntly browser extension. You have access to tools that let you interact with the user's browser and the Huntly information management system.

Your capabilities:
- get_page_content: Extract and read the article content of the current browser tab. Use this when the user asks about the current page, wants a summary, translation, or analysis.
- get_page_selection: Get the text currently selected by the user on the page.
- save_page_to_huntly: Save the current page to the Huntly library for later reading.
- search_huntly: Search the user's saved pages in Huntly by keyword.
- huntly_api: Make API calls to the Huntly server for operations like starring, archiving, or managing pages.

Guidelines:
- If a user message includes an <attached-page-context> block, use that content for current-page requests and do not call get_page_content for that page unless the user asks to refresh it or inspect a different tab.
- When the user asks about "this page", "the current page", or "this article", use get_page_content first unless attached page context is already provided.
- When the user mentions "selected text" or "highlighted text", use get_page_selection.
- When a user message contains a <huntly-prompts> XML block, treat it as a quick prompt. The first line inside the block is the original slash-prompt invocation. Use attached page context when present; otherwise use get_page_content first. Then apply the remaining prompt instructions to that page content. Treat any "User request" text inside the block as additional constraints.
- Be concise and helpful.
- When attachments are included, inspect them directly before answering.`;

type TabContext = { title: string; url: string; faviconUrl?: string };

interface ExtractedSource {
  href: string;
  title: string;
}

interface ParsedPageContext {
  title?: string;
  content?: string;
  url?: string;
  faviconUrl?: string;
  description?: string;
  author?: string;
  siteName?: string;
}

const pageContextTurndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

async function loadModels(): Promise<HuntlyModelInfo[]> {
  const storage = await getAIProvidersStorage();
  const results: HuntlyModelInfo[] = [];

  for (const type of PROVIDER_ORDER) {
    if (type === "huntly-server") continue;

    const config = storage.providers[type] as AIProviderConfig | null;
    if (!config?.enabled) continue;

    const meta = PROVIDER_REGISTRY[type];

    for (const modelId of config.enabledModels) {
      const model = createLanguageModel(
        {
          type,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          enabledModels: config.enabledModels,
          enabled: config.enabled,
        },
        modelId
      );
      if (!model) continue;

      results.push({
        model,
        modelId,
        provider: type,
        displayName: `${meta.displayName} / ${modelId}`,
      });
    }
  }

  return results;
}

async function getTabContext(): Promise<TabContext | null> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.title && tab?.url) {
      return { title: tab.title, url: tab.url, faviconUrl: tab.favIconUrl };
    }
  } catch {
    // Ignore tabs permission failures in restricted pages.
  }
  return null;
}

function sendMessageToTab(tabId: number, message: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function buildPageContextMarkdown(page: ParsedPageContext): string {
  const meta: string[] = [];
  if (page.url) meta.push(`**URL:** ${page.url}`);
  if (page.author) meta.push(`**Author:** ${page.author}`);
  if (page.siteName) meta.push(`**Site:** ${page.siteName}`);
  if (page.description) meta.push(`**Description:** ${page.description}`);

  const parts: string[] = [];
  if (page.title) parts.push(`# ${page.title}`);
  if (meta.length) parts.push(meta.join("  \n"));
  if (page.content) {
    parts.push(`---\n\n${pageContextTurndown.turndown(page.content)}`);
  }

  return parts.join("\n\n");
}

async function createCurrentPageContextPart(): Promise<ChatPart> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id || !tab.url) {
    throw new Error("No active tab found.");
  }

  const response = await sendMessageToTab(tab.id, { type: "parse_doc" });
  const page = response?.page as ParsedPageContext | undefined;
  if (!page?.content) {
    throw new Error("Could not extract page content.");
  }

  const tabTitle = tab.title || page.title || "Current tab";
  const articleTitle = page.title;
  const pageContext: ParsedPageContext = {
    ...page,
    title: articleTitle || tabTitle,
    url: page.url || tab.url,
    faviconUrl: page.faviconUrl || tab.favIconUrl,
  };

  return {
    id: generateId(),
    type: "page-context",
    title: tabTitle,
    articleTitle,
    url: pageContext.url,
    faviconUrl: pageContext.faviconUrl,
    content: buildPageContextMarkdown(pageContext),
    description: pageContext.description,
    author: pageContext.author,
    siteName: pageContext.siteName,
  };
}

function pageContextToTabContext(part: ChatPart | null): TabContext | null {
  if (part?.type !== "page-context") return null;
  if (!part.title && !part.url) return null;
  return {
    title: part.title || "Current tab",
    url: part.url || "",
    faviconUrl: part.faviconUrl,
  };
}

function clonePageContextPart(part: ChatPart): ChatPart {
  return { ...part, id: generateId() };
}

function onConfigChange(callback: () => void): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName !== "sync") return;
    const relevantKeys = [
      "aiProviders",
      "userPrompts",
      "enabledSystemPrompts",
      "defaultTargetLanguage",
    ];
    if (relevantKeys.some((key) => key in changes)) {
      callback();
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

function generateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatFileSize(size: number | undefined): string {
  if (!size) return "";

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted =
    value < 10 && unitIndex > 0 ? value.toFixed(1) : String(Math.round(value));
  return `${formatted} ${units[unitIndex]}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function createAttachmentPart(file: File): Promise<ChatPart> {
  return {
    id: generateId(),
    type: "file",
    filename: file.name,
    mediaType: file.type || "application/octet-stream",
    size: file.size,
    dataUrl: await readFileAsDataUrl(file),
  };
}

function getProviderLabel(provider: string): string {
  return PROVIDER_REGISTRY[provider as ProviderType]?.displayName || provider;
}

function formatModelName(modelId: string | undefined): string {
  if (!modelId) return "Model";

  const withoutDate = modelId.replace(/-\d{8}$/, "");
  if (withoutDate.startsWith("claude-")) {
    return withoutDate
      .replace(/^claude-/, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  return withoutDate.length > 28
    ? `${withoutDate.slice(0, 25)}...`
    : withoutDate;
}

function formatTabHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getMessageText(parts: ChatPart[]): string {
  return parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n");
}

function getDisplayMessageText(parts: ChatPart[]): string {
  return getDisplayMessage(parts).text;
}

function getDisplayMessage(parts: ChatPart[]): {
  text: string;
  promptPrefix: string | null;
} {
  const text = getMessageText(parts);
  const promptMatch = text.match(
    /^\s*<huntly-(?:prompts|command)>\s*\n\s*(\/[^\n]+)[\s\S]*?\n\s*<\/huntly-(?:prompts|command)>\s*$/i
  );

  if (!promptMatch) return { text, promptPrefix: null };

  const displayText = promptMatch[1].trim();
  const prefix = displayText.match(/^\/\S+/)?.[0] || null;
  return { text: displayText, promptPrefix: prefix };
}

function getTriggeredPromptPrefix(
  inputText: string,
  prompts: SlashPrompt[]
): string | null {
  const parsed = parsePromptInput(inputText, prompts);
  return parsed.prompt ? `/${parsed.prompt.trigger}` : null;
}

function addSlashPromptToInput(prompt: SlashPrompt, inputText: string): string {
  const remainingText = inputText.startsWith("/")
    ? inputText.replace(/^\/\S*\s*/, "")
    : inputText.trimStart();

  return `/${prompt.trigger} ${remainingText}`;
}

interface HighlightedPromptTextProps {
  text: string;
  promptPrefix: string | null;
  promptClassName: string;
}

const HighlightedPromptText: FC<HighlightedPromptTextProps> = ({
  text,
  promptPrefix,
  promptClassName,
}) => {
  const prefixIndex = text.match(/^\s*/)?.[0].length || 0;
  if (!promptPrefix || !text.startsWith(promptPrefix, prefixIndex)) {
    return <>{text}</>;
  }

  return (
    <>
      {text.slice(0, prefixIndex)}
      <span className={promptClassName}>{promptPrefix}</span>
      {text.slice(prefixIndex + promptPrefix.length)}
    </>
  );
};

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function prettyPrint(value: unknown): string {
  const parsed = parseMaybeJson(value);
  if (typeof parsed === "string") return parsed;

  try {
    return JSON.stringify(parsed ?? {}, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function extractSources(parts: ChatPart[]): ExtractedSource[] {
  const sources: ExtractedSource[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (
      part.type !== "tool-call" ||
      part.toolName !== "search_huntly" ||
      !part.result
    ) {
      continue;
    }

    const parsed = parseMaybeJson(part.result);
    if (!parsed || typeof parsed !== "object") continue;

    const results = (parsed as { results?: unknown }).results;
    if (!Array.isArray(results)) continue;

    for (const item of results) {
      if (!item || typeof item !== "object") continue;
      const result = item as { url?: unknown; title?: unknown };
      if (typeof result.url !== "string" || typeof result.title !== "string") {
        continue;
      }
      if (seen.has(result.url)) continue;
      seen.add(result.url);
      sources.push({ href: result.url, title: result.title });
    }
  }

  return sources;
}

type SmartMomentProps = {
  dt: string | Date | number;
  timeTypeLabel?: string;
  className?: string;
};

const SmartMoment: FC<SmartMomentProps> = ({
  dt,
  timeTypeLabel,
  className,
}) => {
  const value = moment(dt);
  if (!value.isValid()) return null;

  let text = "";
  if (value.isAfter(moment().add(-1, "d"))) {
    text = value.fromNow(true);
  } else if (value.isBefore(moment().startOf("year"))) {
    text = value.format("ll");
  } else {
    text = value.format("M-D HH:mm");
  }

  const tooltipText = timeTypeLabel
    ? `${timeTypeLabel}: ${value.format("a h:mm ll")}`
    : value.format("a h:mm ll");

  return (
    <Tooltip title={tooltipText} arrow>
      <span className={className}>{text}</span>
    </Tooltip>
  );
};

function getSessionListDate(session: SessionMetadata): string {
  return (
    getStoredLastMessageAt(session) || session.updatedAt || session.createdAt
  );
}

type LegacySessionTiming = {
  lastAssistantResponseAt?: string;
  lastAssistantMessageId?: string;
};

function getStoredLastMessageAt(
  session: SessionData | SessionMetadata
): string | undefined {
  const legacy = session as (SessionData | SessionMetadata) &
    LegacySessionTiming;
  return session.lastMessageAt || legacy.lastAssistantResponseAt;
}

function getStoredLastMessageId(
  session: SessionData | SessionMetadata
): string | undefined {
  const legacy = session as (SessionData | SessionMetadata) &
    LegacySessionTiming;
  return session.lastMessageId || legacy.lastAssistantMessageId;
}

function getTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function hasUnreadMessages(
  session: SessionMetadata,
  currentSessionId: string | null
): boolean {
  const lastMessageAt = getStoredLastMessageAt(session);
  if (session.id === currentSessionId || !lastMessageAt) {
    return false;
  }

  const messageAt = getTimestamp(lastMessageAt);
  const openedAt = getTimestamp(
    session.lastOpenedAt || session.updatedAt || session.createdAt
  );
  return messageAt > openedAt;
}

function getLatestMessage(messages: ChatMessage[]): ChatMessage | null {
  return messages.length > 0 ? messages[messages.length - 1] : null;
}

type DateGroup =
  | "Today"
  | "Yesterday"
  | "Last 7 days"
  | "Last 30 days"
  | "Older";

const DATE_GROUP_ORDER: DateGroup[] = [
  "Today",
  "Yesterday",
  "Last 7 days",
  "Last 30 days",
  "Older",
];

function groupSessionsByDate(
  sessions: SessionMetadata[]
): Map<DateGroup, SessionMetadata[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastMonth = new Date(today);
  lastMonth.setDate(lastMonth.getDate() - 30);

  const groups = new Map<DateGroup, SessionMetadata[]>();

  for (const session of sessions) {
    const date = new Date(getSessionListDate(session));
    let label: DateGroup;
    if (date >= today) label = "Today";
    else if (date >= yesterday) label = "Yesterday";
    else if (date >= lastWeek) label = "Last 7 days";
    else if (date >= lastMonth) label = "Last 30 days";
    else label = "Older";

    const existing = groups.get(label) || [];
    existing.push(session);
    groups.set(label, existing);
  }

  return groups;
}

function useOutsideClick<T extends HTMLElement>(
  active: boolean,
  ref: React.RefObject<T>,
  onClose: () => void
) {
  useEffect(() => {
    if (!active) return;

    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [active, onClose, ref]);
}

function useAutosizeTextArea(
  ref: React.RefObject<HTMLTextAreaElement>,
  value: string
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
  }, [ref, value]);
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
}

const IconButton: FC<IconButtonProps> = ({
  label,
  active = false,
  className = "",
  children,
  ...props
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={[
      "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
      active
        ? "bg-[#e9dcc7] text-[#2f261f]"
        : "text-[#75695b] hover:bg-[#eee7dc] hover:text-[#2f261f]",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </button>
);

interface HistoryDrawerProps {
  open: boolean;
  sessions: SessionMetadata[];
  currentSessionId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const HistoryDrawer: FC<HistoryDrawerProps> = ({
  open,
  sessions,
  currentSessionId,
  onClose,
  onSelect,
  onDelete,
}) => {
  useEffect(() => {
    if (!open) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const groupedSessions = useMemo(
    () => groupSessionsByDate(sessions),
    [sessions]
  );

  return (
    <div
      className={[
        "absolute inset-0 z-40 transition",
        open ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close history"
        className={[
          "absolute inset-0 bg-[#2f261f]/20 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-label="Chat history"
        className={[
          "absolute inset-x-0 bottom-0 flex max-h-[min(74vh,560px)] flex-col rounded-t-2xl border border-b-0 border-[#e2d8c9] bg-[#f7f2e9] shadow-[0_-18px_45px_rgba(64,48,31,0.16)] transition-transform duration-200",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#2f261f]">
            <MessageSquare className="size-4" />
            Chats
          </div>
          <IconButton label="Close history" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-[#8a7e70]">
              No recent chats
            </div>
          ) : (
            <div className="space-y-3">
              {DATE_GROUP_ORDER.filter((label) =>
                groupedSessions.has(label)
              ).map((label) => (
                <div key={label}>
                  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#9a8e7f]">
                    {label}
                  </div>
                  <div className="space-y-1">
                    {groupedSessions.get(label)!.map((session) => {
                      const active = session.id === currentSessionId;
                      const unread = hasUnreadMessages(
                        session,
                        currentSessionId
                      );
                      const listDate = getSessionListDate(session);
                      return (
                        <div
                          key={session.id}
                          className={[
                            "group flex items-center gap-1 rounded-lg",
                            active ? "bg-[#e9dcc7]" : "hover:bg-[#eee7dc]",
                          ].join(" ")}
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 px-3 py-2 text-left"
                            onClick={() => onSelect(session.id)}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <div
                                className={[
                                  "truncate text-sm text-[#332a22]",
                                  unread ? "font-semibold" : "font-medium",
                                ].join(" ")}
                              >
                                {session.title}
                              </div>
                              {unread ? (
                                <span className="shrink-0 rounded-full bg-[#2f6fed] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                                  Unread
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#8a7e70]">
                              <span>{session.messageCount} msgs</span>
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <SmartMoment
                                  dt={listDate}
                                  timeTypeLabel="Last message"
                                />
                              </span>
                            </div>
                          </button>
                          <button
                            type="button"
                            aria-label="Delete chat"
                            title="Delete chat"
                            className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#8a7e70] opacity-0 transition-all hover:bg-[#f4d7cc] hover:text-[#a34020] group-hover:opacity-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete(session.id);
                            }}
                          >
                            <Trash className="size-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

interface ComposerContextBarProps {
  tabContext: TabContext | null;
  contextAttached: boolean;
  contextError: string | null;
  contextLoading: boolean;
  onAttachContext: () => void;
  onDetachContext: () => void;
}

interface TabFaviconProps {
  faviconUrl?: string;
  title?: string;
  muted?: boolean;
}

const TabFavicon: FC<TabFaviconProps> = ({ faviconUrl, title, muted }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [faviconUrl]);

  if (faviconUrl && !failed) {
    return (
      <img
        src={faviconUrl}
        alt=""
        className="h-4 w-4 shrink-0 rounded-sm"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <BookOpen
      aria-label={title || "Current tab"}
      className={[
        "size-4 shrink-0",
        muted ? "text-[#8a7e70]" : "text-[#75695b]",
      ].join(" ")}
    />
  );
};

const ComposerContextBar: FC<ComposerContextBarProps> = ({
  tabContext,
  contextAttached,
  contextError,
  contextLoading,
  onAttachContext,
  onDetachContext,
}) => {
  const label = contextError || tabContext?.title || "Current tab";
  const containerClassName = [
    "mr-3 flex min-w-0 max-w-[min(360px,calc(100%-120px))] items-center gap-1.5 rounded-lg bg-[#fffaf4]/80 px-1.5 py-1 pr-3 shadow-[0_6px_18px_rgba(64,48,31,0.06)] transition-colors",
    contextAttached
      ? "border border-solid border-[#d8cfbf]"
      : "border border-dashed border-[#d8b18d]",
  ].join(" ");
  const tabContextDetails = (
    <>
      <TabFavicon
        faviconUrl={tabContext?.faviconUrl}
        muted={!contextAttached}
        title={tabContext?.title}
      />
      <span
        className={[
          "min-w-0 flex-1 truncate text-xs font-medium leading-5",
          contextError
            ? "text-[#a34020]"
            : contextAttached
            ? "text-[#3c3027]"
            : "italic text-[#8a7e70]",
        ].join(" ")}
      >
        {label}
      </span>
    </>
  );

  if (!contextAttached) {
    return (
      <button
        type="button"
        aria-label="Add current tab context"
        title="Add current tab context"
        disabled={contextLoading || !tabContext}
        className={[
          containerClassName,
          "cursor-pointer text-left hover:bg-[#fff5e8] disabled:cursor-not-allowed disabled:opacity-70",
        ].join(" ")}
        onClick={onAttachContext}
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#8a7e70]">
          {contextLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
        </div>
        {tabContextDetails}
      </button>
    );
  }

  return (
    <div className={containerClassName}>
      <div className="flex h-6 w-6 shrink-0 items-center justify-center">
        <button
          type="button"
          aria-label="Remove attached context"
          title="Remove attached context"
          className="flex h-6 w-6 items-center justify-center rounded-md text-[#75695b] transition-colors hover:bg-[#f1e8da] hover:text-[#2f261f]"
          onClick={onDetachContext}
        >
          <X className="size-3.5" />
        </button>
      </div>
      {tabContextDetails}
    </div>
  );
};

interface ModelDropdownProps {
  models: HuntlyModelInfo[];
  currentModelId: string | null;
  thinkingMode: boolean;
  onSelect: (model: HuntlyModelInfo) => void;
  onOpenSettings: () => void;
  onThinkingModeToggle: () => void;
}

const ModelDropdown: FC<ModelDropdownProps> = ({
  models,
  currentModelId,
  thinkingMode,
  onSelect,
  onOpenSettings,
  onThinkingModeToggle,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(open, wrapperRef, close);

  const currentModel = useMemo(
    () => findModelByKey(models, currentModelId),
    [models, currentModelId]
  );

  const groupedModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? models.filter(
          (model) =>
            model.modelId.toLowerCase().includes(normalizedQuery) ||
            getProviderLabel(model.provider)
              .toLowerCase()
              .includes(normalizedQuery)
        )
      : models;

    const grouped = new Map<string, HuntlyModelInfo[]>();
    for (const model of filtered) {
      const label = getProviderLabel(model.provider);
      grouped.set(label, [...(grouped.get(label) || []), model]);
    }
    return grouped;
  }, [models, query]);

  return (
    <div ref={wrapperRef} className="relative flex min-w-0 items-center">
      <button
        type="button"
        className="flex h-8 max-w-[200px] items-center gap-1 rounded-md px-1.5 text-xs font-medium text-[#6f6254] transition-colors hover:bg-[#eee7dc] hover:text-[#2f261f]"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">
          {formatModelName(currentModel?.modelId)}
        </span>
        {thinkingMode && <Brain className="size-4 shrink-0" />}
        <ChevronDown className="size-4 shrink-0" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-[min(340px,calc(100vw-92px))] overflow-hidden rounded-xl border border-[#d9cfbf] bg-[#fffaf4] shadow-[0_18px_45px_rgba(64,48,31,0.18)]">
          <div className="border-b border-[#e7ded0] p-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-[#f4efe6] px-3 text-[#8a7e70]">
                <Search className="size-4 shrink-0" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search models"
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#2f261f] outline-none placeholder:text-[#9a8e7f]"
                />
              </div>
              <IconButton
                className="h-9 w-9 shrink-0"
                label="Model settings"
                onClick={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
              >
                <Settings className="size-4" />
              </IconButton>
            </div>
          </div>

          <div className="max-h-[330px] overflow-y-auto py-1">
            {groupedModels.size === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-[#8a7e70]">
                No models found
              </div>
            ) : (
              Array.from(groupedModels.entries()).map(
                ([provider, providerModels]) => (
                  <div key={provider} className="py-1">
                    <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#9a8e7f]">
                      {provider}
                    </div>
                    {providerModels.map((model) => {
                      const key = getModelKey(model);
                      const selected = key === currentModelId;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={[
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                            selected
                              ? "bg-[#e9dcc7] text-[#2f261f]"
                              : "text-[#3c3027] hover:bg-[#f1e8da]",
                          ].join(" ")}
                          onClick={() => {
                            onSelect(model);
                            setOpen(false);
                          }}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#efe4d3] text-[11px] font-bold uppercase text-[#7a4a2e]">
                            {provider.slice(0, 1)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {formatModelName(model.modelId)}
                            </span>
                            <span className="block truncate text-xs text-[#8a7e70]">
                              {model.modelId}
                            </span>
                          </span>
                          {selected && <Check className="size-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )
              )
            )}
          </div>

          <div className="border-t border-[#e7ded0] p-2">
            <button
              type="button"
              role="switch"
              aria-checked={thinkingMode}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#3c3027] transition-colors hover:bg-[#f1e8da]"
              onClick={onThinkingModeToggle}
            >
              <Brain
                className={[
                  "size-4 shrink-0",
                  thinkingMode ? "text-[#b15d35]" : "text-[#8a7e70]",
                ].join(" ")}
              />
              <span className="min-w-0 flex-1 font-medium">Thinking</span>
              <span
                aria-hidden="true"
                className={[
                  "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
                  thinkingMode ? "bg-[#d97745]" : "bg-[#d8cfbf]",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[#fffaf4] shadow-sm transition-transform duration-200",
                    thinkingMode ? "translate-x-4" : "translate-x-0",
                  ].join(" ")}
                />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface ComposerActionMenuProps {
  prompts: SlashPrompt[];
  onUploadClick: () => void;
  onPromptSelect: (prompt: SlashPrompt) => void;
}

const ComposerActionMenu: FC<ComposerActionMenuProps> = ({
  prompts,
  onUploadClick,
  onPromptSelect,
}) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(open, wrapperRef, close);

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <IconButton
        active={open}
        label="Add"
        onClick={() => setOpen((value) => !value)}
      >
        <Plus className="size-4" />
      </IconButton>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-[min(320px,calc(100vw-88px))] overflow-hidden rounded-xl border border-[#d9cfbf] bg-[#fffaf4] shadow-[0_16px_42px_rgba(64,48,31,0.16)]">
          <div className="p-1.5">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[#3c3027] transition-colors hover:bg-[#f1e8da]"
              onClick={() => {
                onUploadClick();
                setOpen(false);
              }}
            >
              <Paperclip className="size-4 shrink-0 text-[#8a7e70]" />
              <span className="font-medium">Add photos and files</span>
            </button>
          </div>

          {prompts.length > 0 && (
            <div className="border-t border-[#e7ded0]">
              <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#9a8e7f]">
                Prompts
              </div>
              <div className="max-h-52 overflow-y-auto py-1">
                {prompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#3c3027] transition-colors hover:bg-[#f1e8da]"
                    onClick={() => {
                      onPromptSelect(prompt);
                      setOpen(false);
                    }}
                  >
                    <Sparkles className="size-4 shrink-0 text-[#8a7e70]" />
                    <span className="font-semibold text-[#b15d35]">
                      /{prompt.trigger}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface SlashPromptMenuProps {
  prompts: SlashPrompt[];
  inputText: string;
  selectedIndex: number;
  onSelect: (prompt: SlashPrompt) => void;
}

const SlashPromptMenu: FC<SlashPromptMenuProps> = ({
  prompts,
  inputText,
  selectedIndex,
  onSelect,
}) => {
  const filtered = useMemo(
    () => filterPrompts(inputText, prompts),
    [prompts, inputText]
  );

  if (!inputText.startsWith("/") || filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-xl border border-[#d9cfbf] bg-[#fffaf4] shadow-[0_16px_42px_rgba(64,48,31,0.14)]">
      {filtered.map((prompt, index) => (
        <button
          key={prompt.id}
          type="button"
          className={[
            "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
            index === selectedIndex
              ? "bg-[#e9dcc7] text-[#2f261f]"
              : "text-[#3c3027] hover:bg-[#f1e8da]",
          ].join(" ")}
          onClick={() => onSelect(prompt)}
        >
          <span className="font-semibold text-[#b15d35]">
            /{prompt.trigger}
          </span>
        </button>
      ))}
    </div>
  );
};

const WelcomePane: FC = () => (
  <div className="flex w-full flex-col items-center text-center">
    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d97745] text-[#fffaf4] shadow-sm">
      <Sparkles className="size-6" />
    </div>
    <h1 className="font-serif text-[34px] leading-tight text-[#332a22]">
      Back at it
    </h1>
  </div>
);

interface ComposerProps {
  tabContext: TabContext | null;
  contextAttached: boolean;
  contextError: string | null;
  contextLoading: boolean;
  inputText: string;
  attachments: ChatPart[];
  slashPromptIndex: number;
  slashPrompts: SlashPrompt[];
  isRunning: boolean;
  historyOpen: boolean;
  thinkingMode: boolean;
  models: HuntlyModelInfo[];
  currentModelId: string | null;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  onAttachContext: () => void;
  onDetachContext: () => void;
  onSlashPromptSelect: (prompt: SlashPrompt) => void;
  onAttachmentFiles: (files: FileList) => void;
  onAttachmentRemove: (id: string) => void;
  onModelSelect: (model: HuntlyModelInfo) => void;
  onOpenSettings: () => void;
  onToggleHistory: () => void;
  onNewChat: () => void;
  onThinkingModeToggle: () => void;
}

const Composer: FC<ComposerProps> = ({
  tabContext,
  contextAttached,
  contextError,
  contextLoading,
  inputText,
  attachments,
  slashPromptIndex,
  slashPrompts,
  isRunning,
  historyOpen,
  thinkingMode,
  models,
  currentModelId,
  inputRef,
  onInputChange,
  onKeyDown,
  onSubmit,
  onCancel,
  onAttachContext,
  onDetachContext,
  onSlashPromptSelect,
  onAttachmentFiles,
  onAttachmentRemove,
  onModelSelect,
  onOpenSettings,
  onToggleHistory,
  onNewChat,
  onThinkingModeToggle,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const submitDisabled =
    (!inputText.trim() && attachments.length === 0) || isRunning;
  const triggeredPromptPrefix = useMemo(
    () => getTriggeredPromptPrefix(inputText, slashPrompts),
    [inputText, slashPrompts]
  );

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <div className="mb-2 flex min-h-8 items-center justify-between gap-2 px-1">
        {(tabContext || contextError) && (
          <ComposerContextBar
            contextAttached={contextAttached}
            contextError={contextError}
            contextLoading={contextLoading}
            onAttachContext={onAttachContext}
            onDetachContext={onDetachContext}
            tabContext={tabContext}
          />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <IconButton
            active={historyOpen}
            label="Chat history"
            onClick={onToggleHistory}
          >
            <History className="size-4" />
          </IconButton>
          <IconButton label="New chat" onClick={onNewChat}>
            <SquarePen className="size-4" />
          </IconButton>
        </div>
      </div>
      <form className="relative" onSubmit={onSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(event) => {
            if (event.target.files?.length) {
              onAttachmentFiles(event.target.files);
            }
            event.currentTarget.value = "";
          }}
        />
        <SlashPromptMenu
          prompts={slashPrompts}
          inputText={inputText}
          onSelect={onSlashPromptSelect}
          selectedIndex={slashPromptIndex}
        />

        <div className="rounded-2xl border border-[#d8cfbf] bg-[#fffaf4] shadow-[0_16px_55px_rgba(64,48,31,0.10)]">
          {attachments.length > 0 && (
            <div className="flex flex-wrap items-start gap-2 px-3 pt-3">
              {attachments.map((attachment) => {
                const label = attachment.filename || "Attachment";
                const size = formatFileSize(attachment.size);
                const isImage = attachment.mediaType?.startsWith("image/");
                return isImage && attachment.dataUrl ? (
                  <div
                    key={attachment.id || label}
                    className="relative h-24 w-24 shrink-0 rounded-lg border border-[#ded4c4] bg-[#f4efe6]"
                  >
                    <button
                      type="button"
                      className="h-full w-full overflow-hidden rounded-lg"
                      onClick={() => setPreviewUrl(attachment.dataUrl!)}
                      aria-label={`Preview ${label}`}
                    >
                      <img
                        src={attachment.dataUrl}
                        alt={label}
                        className="h-full w-full object-cover"
                      />
                    </button>
                    {attachment.id && (
                      <button
                        type="button"
                        aria-label={`Remove ${label}`}
                        title={`Remove ${label}`}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#2f261f]/60 text-white transition-colors hover:bg-[#2f261f]/90"
                        onClick={() => onAttachmentRemove(attachment.id!)}
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    key={attachment.id || label}
                    className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-[#ded4c4] bg-[#f4efe6] px-2 py-1 text-xs text-[#5f5347]"
                  >
                    <Paperclip className="size-4 shrink-0 text-[#8a7e70]" />
                    <span className="max-w-[180px] truncate font-medium">
                      {label}
                    </span>
                    {size && (
                      <span className="shrink-0 text-[#8a7e70]">{size}</span>
                    )}
                    {attachment.id && (
                      <button
                        type="button"
                        aria-label={`Remove ${label}`}
                        title={`Remove ${label}`}
                        className="ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#8a7e70] transition-colors hover:bg-[#e9dcc7] hover:text-[#2f261f]"
                        onClick={() => onAttachmentRemove(attachment.id!)}
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="relative min-h-[84px]">
            {triggeredPromptPrefix && inputText && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-4 pt-4 text-[15px] leading-6 text-[#2f261f]"
              >
                <HighlightedPromptText
                  promptClassName="text-[#b15d35]"
                  promptPrefix={triggeredPromptPrefix}
                  text={inputText}
                />
              </div>
            )}
            <textarea
              ref={inputRef}
              value={inputText}
              rows={1}
              className={[
                "relative z-10 min-h-[84px] w-full resize-none bg-transparent px-4 pt-4 text-[15px] leading-6 outline-none placeholder:text-[#8a7e70]",
                triggeredPromptPrefix
                  ? "text-transparent caret-[#2f261f]"
                  : "text-[#2f261f]",
              ].join(" ")}
              placeholder="How can I help you today?"
              onChange={onInputChange}
              onKeyDown={onKeyDown}
            />
          </div>

          <div className="flex min-h-12 items-center justify-between gap-2 px-2 pb-2">
            <div className="flex min-w-0 items-center gap-1">
              <ComposerActionMenu
                prompts={slashPrompts}
                onPromptSelect={onSlashPromptSelect}
                onUploadClick={() => fileInputRef.current?.click()}
              />
              <ModelDropdown
                currentModelId={currentModelId}
                models={models}
                onOpenSettings={onOpenSettings}
                onSelect={onModelSelect}
                onThinkingModeToggle={onThinkingModeToggle}
                thinkingMode={thinkingMode}
              />
            </div>

            {isRunning ? (
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a34020] text-[#fffaf4] transition-colors hover:bg-[#8c351a]"
                aria-label="Stop"
                title="Stop"
                onClick={onCancel}
              >
                <Square className="size-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitDisabled}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2f261f] text-[#fffaf4] transition-colors hover:bg-[#46382d] disabled:cursor-not-allowed disabled:bg-[#d7cbbb] disabled:text-[#8a7e70]"
                aria-label="Send"
                title="Send"
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>
        </div>
      </form>

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f261f]/60"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            type="button"
            aria-label="Close preview"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#2f261f]/60 text-white transition-colors hover:bg-[#2f261f]/90"
            onClick={() => setPreviewUrl(null)}
          >
            <X className="size-5" />
          </button>
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

const LoadingScreen: FC = () => (
  <div className="flex h-full items-center justify-center bg-[#f7f3ea] text-[#75695b]">
    <Loader2 className="size-6 animate-spin" />
  </div>
);

interface EmptyProvidersProps {
  onOpenSettings: () => void;
}

const EmptyProviders: FC<EmptyProvidersProps> = ({ onOpenSettings }) => (
  <div className="flex h-full items-center justify-center bg-[#f7f3ea] px-8">
    <div className="max-w-sm text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f1e4d2] text-[#b15d35]">
        <AlertTriangle className="size-6" />
      </div>
      <div className="text-lg font-semibold text-[#332a22]">
        No AI providers configured
      </div>
      <div className="mt-2 text-sm leading-6 text-[#75695b]">
        Configure at least one AI provider in settings to start chatting.
      </div>
      <button
        type="button"
        className="mt-5 rounded-lg bg-[#2f261f] px-4 py-2 text-sm font-medium text-[#fffaf4] transition-colors hover:bg-[#46382d]"
        onClick={onOpenSettings}
      >
        Open settings
      </button>
    </div>
  </div>
);

interface ReasoningBlockProps {
  text: string;
  streaming: boolean;
}

const ReasoningBlock: FC<ReasoningBlockProps> = ({ text, streaming }) => (
  <details
    className="mb-4 rounded-lg border border-[#ded4c4] bg-[#fffaf4]/70 px-3 py-2"
    open={streaming}
  >
    <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-[#6f6254]">
      <Brain className="size-4" />
      Thoughts
      {streaming && (
        <span className="ml-auto flex gap-1">
          <span className="claude-dot" />
          <span className="claude-dot [animation-delay:120ms]" />
          <span className="claude-dot [animation-delay:240ms]" />
        </span>
      )}
    </summary>
    <div className="claude-markdown mt-3 border-t border-[#e7ded0] pt-3 text-sm text-[#75695b]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text || "Thinking..."}
      </ReactMarkdown>
    </div>
  </details>
);

interface SourcesBlockProps {
  sources: ExtractedSource[];
}

const SourcesBlock: FC<SourcesBlockProps> = ({ sources }) => {
  if (sources.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {sources.map((source) => (
        <a
          key={source.href}
          href={source.href}
          target="_blank"
          rel="noreferrer"
          className="flex max-w-full items-center gap-1.5 rounded-full border border-[#ded4c4] bg-[#fffaf4]/80 px-3 py-1.5 text-xs font-medium text-[#6f6254] transition-colors hover:border-[#d8b18d] hover:text-[#2f261f]"
        >
          <ExternalLink className="size-4 shrink-0" />
          <span className="truncate">{source.title}</span>
        </a>
      ))}
    </div>
  );
};

interface ToolCallBlockProps {
  part: ChatPart;
}

const ToolCallBlock: FC<ToolCallBlockProps> = ({ part }) => {
  const [open, setOpen] = useState(false);
  const complete = part.result !== undefined;
  const error = Boolean(part.isError);

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-[#ded4c4] bg-[#fffaf4]/80">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#5f5347] transition-colors hover:bg-[#f4efe6]"
        onClick={() => setOpen((value) => !value)}
      >
        <Wrench className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {part.toolName || "Tool call"}
        </span>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            error
              ? "bg-[#f4d7cc] text-[#a34020]"
              : complete
              ? "bg-[#e6ead5] text-[#5d6a2e]"
              : "bg-[#f1e4d2] text-[#9a5a30]",
          ].join(" ")}
        >
          {error ? "Error" : complete ? "Done" : "Running"}
        </span>
        <ChevronDown
          className={[
            "size-3.5 shrink-0 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>
      {open && (
        <div className="space-y-3 border-t border-[#e7ded0] p-3">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#9a8e7f]">
              Input
            </div>
            <pre className="max-h-52 overflow-auto rounded-lg bg-[#2f261f] p-3 text-xs leading-5 text-[#fffaf4]">
              {prettyPrint(part.args || part.argsText || {})}
            </pre>
          </div>
          {part.result !== undefined && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#9a8e7f]">
                Output
              </div>
              <pre className="max-h-52 overflow-auto rounded-lg bg-[#2f261f] p-3 text-xs leading-5 text-[#fffaf4]">
                {prettyPrint(part.result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface AssistantMessageProps {
  message: ChatMessage;
  isLast: boolean;
  isRunning: boolean;
  thinkingMode: boolean;
  onRegenerate?: () => void;
}

const AssistantMessage: FC<AssistantMessageProps> = ({
  message,
  isLast,
  isRunning,
  thinkingMode,
  onRegenerate,
}) => {
  const hasReasoningText = message.parts.some(
    (part) => part.type === "reasoning" && part.text?.trim()
  );
  const showThinkingPreview =
    thinkingMode && isLast && isRunning && !hasReasoningText;
  const sources = extractSources(message.parts);
  const text = getMessageText(message.parts);

  return (
    <div className="group flex gap-3">
      <div className="min-w-0 flex-1">
        <SourcesBlock sources={sources} />
        {showThinkingPreview && (
          <ReasoningBlock streaming={true} text="Thinking..." />
        )}

        {message.parts.map((part, index) => {
          if (part.type === "reasoning") {
            if (!part.text?.trim()) return null;

            return (
              <ReasoningBlock
                key={part.id || `${message.id}-${index}`}
                streaming={
                  isLast && isRunning && index === message.parts.length - 1
                }
                text={part.text}
              />
            );
          }
          if (part.type === "tool-call") {
            return <ToolCallBlock key={part.toolCallId || index} part={part} />;
          }
          if (part.type === "text" && part.text?.trim()) {
            return (
              <div
                key={`${message.id}-${index}`}
                className="claude-markdown text-[15px] leading-7 text-[#332a22]"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {part.text}
                </ReactMarkdown>
              </div>
            );
          }
          return null;
        })}

        {isLast && isRunning && message.parts.length === 0 && (
          <div className="flex h-8 items-center gap-1">
            <span className="claude-dot" />
            <span className="claude-dot [animation-delay:120ms]" />
            <span className="claude-dot [animation-delay:240ms]" />
          </div>
        )}

        {isLast && !isRunning && (
          <div className="mt-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <IconButton
              disabled={!text}
              label="Copy"
              onClick={() => {
                if (text) void navigator.clipboard.writeText(text);
              }}
            >
              <Copy className="size-4" />
            </IconButton>
            {onRegenerate && (
              <IconButton label="Regenerate" onClick={onRegenerate}>
                <RotateCcw className="size-4" />
              </IconButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface PageContextBadgeProps {
  part: ChatPart;
}

const PAGE_CONTEXT_BADGE_CLASS =
  "flex min-w-0 max-w-[min(360px,100%)] items-center gap-2 rounded-lg border border-solid border-[#d8cfbf] bg-[#fffaf4]/70 px-2 py-1.5 text-xs text-[#5f5347] no-underline shadow-sm hover:no-underline";

const PageContextBadge: FC<PageContextBadgeProps> = ({ part }) => {
  const content = (
    <>
      <TabFavicon faviconUrl={part.faviconUrl} title={part.title} />
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium text-[#3c3027]">
          {part.title || "Attached page"}
        </span>
        {part.url && (
          <span className="block truncate text-[11px] leading-4 text-[#75695b]">
            {formatTabHost(part.url)}
          </span>
        )}
      </div>
    </>
  );

  if (part.url) {
    return (
      <a
        href={part.url}
        target="_blank"
        rel="noreferrer"
        className={PAGE_CONTEXT_BADGE_CLASS}
      >
        {content}
      </a>
    );
  }

  return <div className={PAGE_CONTEXT_BADGE_CLASS}>{content}</div>;
};

interface UserMessageProps {
  message: ChatMessage;
}

const UserMessage: FC<UserMessageProps> = ({ message }) => {
  const display = getDisplayMessage(message.parts);
  const text = display.text;
  const pageContexts = message.parts.filter(
    (part) => part.type === "page-context"
  );
  const attachments = message.parts.filter((part) => part.type === "file");

  return (
    <div className="flex justify-end">
      <div className="flex max-w-[82%] flex-col items-end">
        {(text || attachments.length > 0) && (
          <div className="max-w-full rounded-2xl bg-[#e9dcc7] px-4 py-3 text-[15px] leading-6 text-[#332a22] shadow-sm">
            {text && (
              <div className="whitespace-pre-wrap">
                <HighlightedPromptText
                  promptClassName="font-semibold text-[#a34020]"
                  promptPrefix={display.promptPrefix}
                  text={text}
                />
              </div>
            )}
            {attachments.length > 0 && (
              <div
                className={["flex flex-wrap gap-2", text ? "mt-2" : ""].join(
                  " "
                )}
              >
                {attachments.map((attachment, index) => {
                  const label = attachment.filename || "Attachment";
                  const size = formatFileSize(attachment.size);
                  return (
                    <div
                      key={attachment.id || `${label}-${index}`}
                      className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg bg-[#fffaf4]/70 px-2 py-1 text-xs text-[#5f5347]"
                    >
                      <Paperclip className="size-4 shrink-0 text-[#8a7e70]" />
                      <span className="max-w-[180px] truncate font-medium">
                        {label}
                      </span>
                      {size && (
                        <span className="shrink-0 text-[#8a7e70]">{size}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {pageContexts.length > 0 && (
          <div className="mt-2 flex max-w-full flex-wrap justify-end gap-2">
            {pageContexts.map((part, index) => (
              <PageContextBadge
                key={part.id || `${part.title || "page"}-${index}`}
                part={part}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface MessageListProps {
  messages: ChatMessage[];
  isRunning: boolean;
  thinkingMode: boolean;
  onRegenerate?: () => void;
  endRef: React.RefObject<HTMLDivElement>;
}

const MessageList: FC<MessageListProps> = ({
  messages,
  isRunning,
  thinkingMode,
  onRegenerate,
  endRef,
}) => (
  <div className="min-h-full px-5 py-6">
    <div className="mx-auto flex max-w-[760px] flex-col gap-8">
      {messages.map((message, index) =>
        message.role === "user" ? (
          <UserMessage key={message.id} message={message} />
        ) : (
          <AssistantMessage
            key={message.id}
            isLast={index === messages.length - 1}
            isRunning={isRunning}
            message={message}
            onRegenerate={
              index === messages.length - 1 ? onRegenerate : undefined
            }
            thinkingMode={thinkingMode}
          />
        )
      )}
      <div ref={endRef} />
    </div>
  </div>
);

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

  const currentModelRef = useRef<HuntlyModelInfo | null>(null);
  const thinkingModeRef = useRef(false);
  const sessionRef = useRef<SessionData | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const skipNextMessagesPersistRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleMessagesChange = useCallback((chatMessages: ChatMessage[]) => {
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
          textParts.length <= 60 ? textParts : `${textParts.slice(0, 57)}...`;
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
        session.lastOpenedAt || session.updatedAt || session.createdAt,
    };
    sessionRef.current = updated;
    saveSession(updated).catch((error) => {
      console.error("[SidepanelApp] Failed to save session", error);
    });
  }, []);

  const chat = useHuntlyChat({
    getModelInfo: () => currentModelRef.current,
    getThinkingMode: () => thinkingModeRef.current,
    systemPrompt: SIDEPANEL_SYSTEM_PROMPT,
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
      const [availableModels, prompts, savedModelId, savedThinkingMode, tab] =
        await Promise.all([
          loadModels(),
          loadSlashPrompts(),
          getSidepanelSelectedModelId(),
          getSidepanelThinkingModeEnabled(),
          getTabContext(),
        ]);
      if (cancelled) return;

      setModels(availableModels);
      setSlashPrompts(prompts);
      setThinkingMode(savedThinkingMode);
      setTabContext(tab);

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
      const [updatedModels, updatedPrompts] = await Promise.all([
        loadModels(),
        loadSlashPrompts(),
      ]);
      setModels(updatedModels);
      setSlashPrompts(updatedPrompts);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isRunning]);

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

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await deleteSession(id);
      setSessions((previous) =>
        previous.filter((session) => session.id !== id)
      );
      if (currentSessionIdRef.current === id) {
        sessionRef.current = null;
        currentSessionIdRef.current = null;
        setCurrentSessionId(null);
        setAttachedPageContext(null);
        setContextError(null);
        setAttachments([]);
        clearMessages();
      }
    },
    [clearMessages]
  );

  const handleSelectSession = useCallback(
    async (id: string) => {
      try {
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
          setAttachedPageContext(null);
        } else {
          clearMessages();
          setAttachedPageContext(null);
        }

        setContextError(null);
        setAttachments([]);
        setHistoryOpen(false);
        saveSession(openedSession).catch((error) => {
          console.error("[SidepanelApp] Failed to mark session opened", error);
        });
      } catch (error) {
        console.error("[SidepanelApp] Failed to open session", error);
      }
    },
    [clearMessages, setMessages]
  );

  const handleNewChat = useCallback(() => {
    sessionRef.current = null;
    currentSessionIdRef.current = null;
    setCurrentSessionId(null);
    setHistoryOpen(false);
    setAttachedPageContext(null);
    setContextError(null);
    setInputText("");
    setAttachments([]);
    setSlashPromptIndex(0);
    clearMessages();
    inputRef.current?.focus();
  }, [clearMessages]);

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
      sendMessage(finalText, messageParts);
      setAttachedPageContext(null);
      setContextError(null);
      setInputText("");
      setAttachments([]);
      setSlashPromptIndex(0);
    },
    [attachedPageContext, attachments, isRunning, sendMessage, slashPrompts]
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
          inputText === inputText.split(" ")[0]
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
    const optionsUrl = chrome.runtime.getURL("options.html");
    const url = `${optionsUrl}#ai-providers`;
    if (chrome.tabs?.create) {
      chrome.tabs.create({ url });
      return;
    }
    chrome.runtime.sendMessage({ type: "open_tab", url });
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
        onClose={() => setHistoryOpen(false)}
        onDelete={(id) => void handleDeleteSession(id)}
        onSelect={(id) => void handleSelectSession(id)}
        open={historyOpen}
        sessions={sessions}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
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
          <Composer
            attachments={attachments}
            contextAttached={Boolean(attachedPageContext)}
            contextError={contextError}
            contextLoading={contextLoading}
            currentModelId={currentModelId}
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
