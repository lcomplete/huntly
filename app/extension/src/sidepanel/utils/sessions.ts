import type {
  ChatMessage,
  SessionData,
  SessionMetadata,
} from "../types";
import { getDisplayMessageText } from "./messageParts";

type LegacySessionTiming = {
  lastAssistantResponseAt?: string;
  lastAssistantMessageId?: string;
};

export const DEFAULT_SESSION_TITLE = "New chat";
const SESSION_TITLE_MAX_LENGTH = 40;

export function getStoredLastMessageAt(
  session: SessionData | SessionMetadata
): string | undefined {
  const legacy = session as (SessionData | SessionMetadata) &
    LegacySessionTiming;
  return session.lastMessageAt || legacy.lastAssistantResponseAt;
}

export function getStoredLastMessageId(
  session: SessionData | SessionMetadata
): string | undefined {
  const legacy = session as (SessionData | SessionMetadata) &
    LegacySessionTiming;
  return session.lastMessageId || legacy.lastAssistantMessageId;
}

export function getSessionListDate(session: SessionMetadata): string {
  return (
    getStoredLastMessageAt(session) || session.updatedAt || session.createdAt
  );
}

function getTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function deriveSessionTitle(
  messages: ChatMessage[],
  currentTitle: string = DEFAULT_SESSION_TITLE
): string {
  const trimmedTitle = currentTitle.trim();
  if (trimmedTitle && trimmedTitle !== DEFAULT_SESSION_TITLE) {
    return currentTitle;
  }

  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage) {
    return trimmedTitle || DEFAULT_SESSION_TITLE;
  }

  const text = getDisplayMessageText(firstUserMessage.parts)
    .replace(/\s+/g, " ")
    .trim();

  const fallback = getTitleFallbackFromParts(firstUserMessage.parts);
  const candidate = text || fallback;

  if (!candidate) {
    return trimmedTitle || DEFAULT_SESSION_TITLE;
  }

  return candidate.length <= SESSION_TITLE_MAX_LENGTH
    ? candidate
    : `${candidate.slice(0, SESSION_TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

function getTitleFallbackFromParts(parts: ChatMessage["parts"]): string {
  for (const part of parts) {
    if (part.type === "page-context") {
      const label = (part.articleTitle || part.title || part.url || "").trim();
      if (label) return label;
    }
    if (part.type === "file" && part.filename) {
      return part.filename;
    }
  }
  return "";
}

export function getSessionSortTime(session: SessionMetadata): number {
  const legacy = session as SessionMetadata & LegacySessionTiming;
  return getTimestamp(
    session.lastMessageAt ||
      legacy.lastAssistantResponseAt ||
      session.updatedAt ||
      session.createdAt
  );
}

export function compareSessionMetadataByActivity(
  a: SessionMetadata,
  b: SessionMetadata
): number {
  const pinnedDelta = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
  if (pinnedDelta !== 0) return pinnedDelta;

  if (a.pinned && b.pinned) {
    const pinnedAtDelta = getTimestamp(b.pinnedAt) - getTimestamp(a.pinnedAt);
    if (pinnedAtDelta !== 0) return pinnedAtDelta;
  }

  const messageDelta = getSessionSortTime(b) - getSessionSortTime(a);
  if (messageDelta !== 0) return messageDelta;

  const createdDelta = getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
  if (createdDelta !== 0) return createdDelta;

  return a.id.localeCompare(b.id);
}

export function sortSessionMetadataByActivity(
  sessions: SessionMetadata[]
): SessionMetadata[] {
  return [...sessions].sort(compareSessionMetadataByActivity);
}

export function hasUnreadMessages(
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

export function getLatestMessage(
  messages: ChatMessage[]
): ChatMessage | null {
  return messages.length > 0 ? messages[messages.length - 1] : null;
}

export type DateGroup =
  | "Pinned"
  | "Today"
  | "Yesterday"
  | "Last 7 days"
  | "Last 30 days"
  | "Older";

export const DATE_GROUP_ORDER: DateGroup[] = [
  "Pinned",
  "Today",
  "Yesterday",
  "Last 7 days",
  "Last 30 days",
  "Older",
];

export function groupSessionsByDate(
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
    let label: DateGroup;
    if (session.pinned) {
      label = "Pinned";
    } else {
      const date = new Date(getSessionListDate(session));
      if (date >= today) label = "Today";
      else if (date >= yesterday) label = "Yesterday";
      else if (date >= lastWeek) label = "Last 7 days";
      else if (date >= lastMonth) label = "Last 30 days";
      else label = "Older";
    }

    const existing = groups.get(label) || [];
    existing.push(session);
    groups.set(label, existing);
  }

  return groups;
}
