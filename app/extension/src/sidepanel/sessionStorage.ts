/**
 * IndexedDB session storage — dual-store pattern.
 *
 * Three object stores:
 * - `sessions`: Full session data with messages
 * - `session-metadata`: Lightweight listing data
 * - `session-attachments`: Binary attachment blobs referenced by message parts
 */

import type { ChatMessage, SessionData, SessionMetadata } from "./types";
import { readBlobAsDataUrl } from "./utils/dom";

const DB_NAME = "huntly-agent";
const DB_VERSION = 2;
const SESSIONS_STORE = "sessions";
const METADATA_STORE = "session-metadata";
const ATTACHMENTS_STORE = "session-attachments";
const ATTACHMENTS_BY_SESSION_INDEX = "by-sessionId";

type StoredAttachmentRecord = {
  id: string;
  sessionId: string;
  blob: Blob;
  createdAt: string;
  mediaType?: string;
  size?: number;
};

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

        const attachmentsStore = db.objectStoreNames.contains(ATTACHMENTS_STORE)
          ? request.transaction!.objectStore(ATTACHMENTS_STORE)
          : db.createObjectStore(ATTACHMENTS_STORE, { keyPath: "id" });

        if (
          !attachmentsStore.indexNames.contains(ATTACHMENTS_BY_SESSION_INDEX)
        ) {
          attachmentsStore.createIndex(
            ATTACHMENTS_BY_SESSION_INDEX,
            "sessionId",
            { unique: false }
          );
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

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("Failed to decode attachment data");
  }

  return response.blob();
}

type SerializedSession = {
  session: SessionData;
  attachments: StoredAttachmentRecord[];
  referencedAttachmentIds: Set<string>;
};

async function serializeSessionAttachments(
  session: SessionData
): Promise<SerializedSession> {
  const attachmentRecords = new Map<string, Promise<StoredAttachmentRecord>>();
  const referencedAttachmentIds = new Set<string>();

  const messages = await Promise.all(
    session.messages.map(async (message) => ({
      ...message,
      parts: await Promise.all(
        message.parts.map(async (part) => {
          if (part.type !== "file") return part;

          const attachmentId = part.attachmentId || crypto.randomUUID();
          referencedAttachmentIds.add(attachmentId);

          if (!part.attachmentId) {
            part.attachmentId = attachmentId;
          }

          if (part.dataUrl && !attachmentRecords.has(attachmentId)) {
            attachmentRecords.set(
              attachmentId,
              dataUrlToBlob(part.dataUrl).then((blob) => ({
                id: attachmentId,
                sessionId: session.id,
                blob,
                createdAt: session.updatedAt,
                mediaType: part.mediaType,
                size: part.size,
              }))
            );
          }

          return {
            ...part,
            attachmentId,
            dataUrl: undefined,
          };
        })
      ),
    }))
  );

  return {
    session: {
      ...session,
      messages,
    },
    attachments: await Promise.all(attachmentRecords.values()),
    referencedAttachmentIds,
  };
}

async function getAttachmentIdsForSession(
  attachmentStore: IDBObjectStore,
  sessionId: string
): Promise<string[]> {
  const index = attachmentStore.index(ATTACHMENTS_BY_SESSION_INDEX);
  const keys = (await requestToPromise(
    index.getAllKeys(sessionId)
  )) as IDBValidKey[];

  return keys.map((key) => String(key));
}

async function getAttachmentsForSession(
  attachmentStore: IDBObjectStore,
  sessionId: string
): Promise<StoredAttachmentRecord[]> {
  const index = attachmentStore.index(ATTACHMENTS_BY_SESSION_INDEX);
  return ((await requestToPromise(index.getAll(sessionId))) || []) as
    | StoredAttachmentRecord[]
    | [];
}

async function hydrateSessionAttachments(
  session: SessionData,
  attachments: StoredAttachmentRecord[]
): Promise<SessionData> {
  const attachmentMap = new Map(attachments.map((attachment) => [attachment.id, attachment]));
  const dataUrlCache = new Map<string, Promise<string>>();

  const messages = await Promise.all(
    session.messages.map(async (message) => ({
      ...message,
      parts: await Promise.all(
        message.parts.map(async (part) => {
          if (
            part.type !== "file" ||
            part.dataUrl ||
            !part.attachmentId ||
            !attachmentMap.has(part.attachmentId)
          ) {
            return part;
          }

          let dataUrlPromise = dataUrlCache.get(part.attachmentId);
          if (!dataUrlPromise) {
            dataUrlPromise = readBlobAsDataUrl(
              attachmentMap.get(part.attachmentId)!.blob
            );
            dataUrlCache.set(part.attachmentId, dataUrlPromise);
          }

          const attachment = attachmentMap.get(part.attachmentId)!;
          return {
            ...part,
            mediaType:
              part.mediaType ||
              attachment.mediaType ||
              attachment.blob.type ||
              "application/octet-stream",
            size: part.size ?? attachment.size ?? attachment.blob.size,
            dataUrl: await dataUrlPromise,
          };
        })
      ),
    }))
  );

  return {
    ...session,
    messages,
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
  const serialized = await serializeSessionAttachments(normalizedSession);
  const metadata = buildSessionMetadata(serialized.session);
  const safeSession: SessionData = JSON.parse(
    JSON.stringify(serialized.session)
  );
  const safeMetadata: SessionMetadata = JSON.parse(JSON.stringify(metadata));
  await withTransaction(
    [SESSIONS_STORE, METADATA_STORE, ATTACHMENTS_STORE],
    "readwrite",
    async (stores) => {
      const existingAttachmentIds = await getAttachmentIdsForSession(
        stores[ATTACHMENTS_STORE],
        safeSession.id
      );
      const removedAttachmentIds = existingAttachmentIds.filter(
        (id) => !serialized.referencedAttachmentIds.has(id)
      );

      await Promise.all([
        requestToPromise(stores[SESSIONS_STORE].put(safeSession)),
        requestToPromise(stores[METADATA_STORE].put(safeMetadata)),
        ...serialized.attachments.map((attachment) =>
          requestToPromise(stores[ATTACHMENTS_STORE].put(attachment))
        ),
        ...removedAttachmentIds.map((attachmentId) =>
          requestToPromise(stores[ATTACHMENTS_STORE].delete(attachmentId))
        ),
      ]);
    }
  );
}

export async function getSession(
  sessionId: string
): Promise<SessionData | null> {
  return withTransaction(
    [SESSIONS_STORE, ATTACHMENTS_STORE],
    "readonly",
    async (stores) => {
      const session =
        ((await requestToPromise(
          stores[SESSIONS_STORE].get(sessionId)
        )) as SessionData | null) || null;

      if (!session) return null;

      const attachments = await getAttachmentsForSession(
        stores[ATTACHMENTS_STORE],
        sessionId
      );

      return hydrateSessionAttachments(session, attachments);
    }
  );
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
    [SESSIONS_STORE, METADATA_STORE, ATTACHMENTS_STORE],
    "readwrite",
    async (stores) => {
      const attachmentIds = await getAttachmentIdsForSession(
        stores[ATTACHMENTS_STORE],
        sessionId
      );

      await Promise.all([
        requestToPromise(stores[SESSIONS_STORE].delete(sessionId)),
        requestToPromise(stores[METADATA_STORE].delete(sessionId)),
        ...attachmentIds.map((attachmentId) =>
          requestToPromise(stores[ATTACHMENTS_STORE].delete(attachmentId))
        ),
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
