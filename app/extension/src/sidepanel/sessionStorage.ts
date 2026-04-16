/**
 * IndexedDB session storage — dual-store pattern.
 *
 * Two object stores:
 * - `sessions`: Full session data with messages
 * - `session-metadata`: Lightweight listing data
 */

import type { ChatMessage, SessionData, SessionMetadata } from "./types";

const DB_NAME = "huntly-agent";
const DB_VERSION = 1;
const SESSIONS_STORE = "sessions";
const METADATA_STORE = "session-metadata";

let databasePromise: Promise<IDBDatabase> | null = null;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("IndexedDB request failed"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error || new Error("Failed to open IndexedDB"));
    });
  }
  return databasePromise;
}

async function withTransaction<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  run: (stores: Record<string, IDBObjectStore>) => Promise<T> | T
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores = storeNames.reduce<Record<string, IDBObjectStore>>(
      (acc, name) => {
        acc[name] = transaction.objectStore(name);
        return acc;
      },
      {}
    );

    Promise.resolve(run(stores))
      .then((result) => {
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () =>
          reject(transaction.error || new Error("Transaction failed"));
        transaction.onabort = () =>
          reject(transaction.error || new Error("Transaction aborted"));
      })
      .catch((error) => {
        transaction.abort();
        reject(error);
      });
  });
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

function getMessageText(parts: ChatMessage["parts"]): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("\n");
}

function getDisplayMessageText(parts: ChatMessage["parts"]): string {
  const text = getMessageText(parts);
  const promptMatch = text.match(
    /^\s*<huntly-(?:prompts|command)>\s*\n\s*(\/[^\n]+)[\s\S]*?\n\s*<\/huntly-(?:prompts|command)>\s*$/i
  );

  return promptMatch ? promptMatch[1].trim() : text;
}

export function getMessageTextPreview(messages: ChatMessage[]): string {
  const preview = messages
    .map((message) => {
      return getDisplayMessageText(message.parts);
    })
    .filter(Boolean)
    .join("\n")
    .trim();

  return preview.slice(0, 2000);
}

type LegacySessionTiming = {
  lastAssistantResponseAt?: string;
  lastAssistantMessageId?: string;
};

function getLatestMessage(messages: ChatMessage[]): ChatMessage | null {
  return messages.length > 0 ? messages[messages.length - 1] : null;
}

function normalizeSessionTiming(session: SessionData): SessionData {
  const latestMessage = getLatestMessage(session.messages);
  const legacy = session as SessionData & LegacySessionTiming;
  return {
    id: session.id,
    title: session.title,
    currentModelId: session.currentModelId,
    thinkingEnabled: session.thinkingEnabled,
    messages: session.messages,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastMessageAt:
      session.lastMessageAt ||
      legacy.lastAssistantResponseAt ||
      (latestMessage ? session.updatedAt : undefined),
    lastMessageId:
      session.lastMessageId ||
      legacy.lastAssistantMessageId ||
      latestMessage?.id,
    lastOpenedAt:
      session.lastOpenedAt || session.updatedAt || session.createdAt,
  };
}

export function buildSessionMetadata(session: SessionData): SessionMetadata {
  const normalized = normalizeSessionTiming(session);
  return {
    id: normalized.id,
    title: normalized.title,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    lastMessageAt: normalized.lastMessageAt,
    lastMessageId: normalized.lastMessageId,
    lastOpenedAt: normalized.lastOpenedAt,
    messageCount: normalized.messages.length,
    preview: getMessageTextPreview(normalized.messages),
    currentModelId: normalized.currentModelId,
  };
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function saveSession(session: SessionData): Promise<void> {
  const normalizedSession = normalizeSessionTiming(session);
  const metadata = buildSessionMetadata(normalizedSession);
  const safeSession: SessionData = JSON.parse(
    JSON.stringify(normalizedSession)
  );
  const safeMetadata: SessionMetadata = JSON.parse(JSON.stringify(metadata));
  await withTransaction(
    [SESSIONS_STORE, METADATA_STORE],
    "readwrite",
    async (stores) => {
      await Promise.all([
        requestToPromise(stores[SESSIONS_STORE].put(safeSession)),
        requestToPromise(stores[METADATA_STORE].put(safeMetadata)),
      ]);
    }
  );
}

export async function getSession(
  sessionId: string
): Promise<SessionData | null> {
  return withTransaction([SESSIONS_STORE], "readonly", async (stores) => {
    return (
      (await requestToPromise(stores[SESSIONS_STORE].get(sessionId))) || null
    );
  });
}

export async function listSessionMetadata(): Promise<SessionMetadata[]> {
  return withTransaction([METADATA_STORE], "readonly", async (stores) => {
    const metadata = ((await requestToPromise(
      stores[METADATA_STORE].getAll()
    )) || []) as SessionMetadata[];
    return metadata.sort((a, b) => {
      const responseDelta = getSessionSortTime(b) - getSessionSortTime(a);
      if (responseDelta !== 0) return responseDelta;

      const createdDelta =
        getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
      if (createdDelta !== 0) return createdDelta;

      return a.id.localeCompare(b.id);
    });
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await withTransaction(
    [SESSIONS_STORE, METADATA_STORE],
    "readwrite",
    async (stores) => {
      await Promise.all([
        requestToPromise(stores[SESSIONS_STORE].delete(sessionId)),
        requestToPromise(stores[METADATA_STORE].delete(sessionId)),
      ]);
    }
  );
}

export function createEmptySession(currentModelId: string | null): SessionData {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    currentModelId,
    thinkingEnabled: false,
    messages: [],
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
}

function getTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getSessionSortTime(session: SessionMetadata): number {
  const legacy = session as SessionMetadata & LegacySessionTiming;
  return getTimestamp(
    session.lastMessageAt ||
      legacy.lastAssistantResponseAt ||
      session.updatedAt ||
      session.createdAt
  );
}
