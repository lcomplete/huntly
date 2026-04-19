import type {
  ChatMessage,
  SessionData,
  SessionMetadata,
} from "../types";

type LegacySessionTiming = {
  lastAssistantResponseAt?: string;
  lastAssistantMessageId?: string;
};

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
  | "Today"
  | "Yesterday"
  | "Last 7 days"
  | "Last 30 days"
  | "Older";

export const DATE_GROUP_ORDER: DateGroup[] = [
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
