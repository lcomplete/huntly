/**
 * IndexedDB session storage — dual-store pattern.
 *
 * Three object stores:
 * - `sessions`: Full session data with messages
 * - `session-metadata`: Lightweight listing data
 * - `session-attachments`: Binary attachment blobs referenced by message parts
 */

import type {
  ChatMessage,
  SessionData,
  SessionMetadata,
  SessionTitleGenerationStatus,
} from "./types";
import { readBlobAsDataUrl } from "./utils/dom";
import { getDisplayMessageText } from "./utils/messageParts";
import {
  DEFAULT_SESSION_TITLE,
  sortSessionMetadataByActivity,
} from "./utils/sessions";

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

function normalizeTitleGenerationStatus(
  status?: SessionTitleGenerationStatus
): SessionTitleGenerationStatus {
  switch (status) {
    case "generated":
    case "failed":
      return status;
    default:
      return "idle";
  }
}

function normalizeMessageTimestamps(session: SessionData): ChatMessage[] {
  const fallbackTimestamp = session.createdAt || session.updatedAt;
  let lastKnownTimestamp = fallbackTimestamp;

  return session.messages.map((message) => {
    const createdAt = message.createdAt || lastKnownTimestamp;
    lastKnownTimestamp = createdAt;

    return message.createdAt === createdAt
      ? message
      : {
          ...message,
          createdAt,
        };
  });
}

function normalizeSessionTiming(session: SessionData): SessionData {
  const messages = normalizeMessageTimestamps(session);
  const latestMessage = getLatestMessage(messages);
  const legacy = session as SessionData & LegacySessionTiming;
  const normalizedTitleGenerationStatus = normalizeTitleGenerationStatus(
    session.titleGenerationStatus
  );
  const pinned = Boolean(session.pinned);
  const archived = Boolean(session.archived);
  return {
    id: session.id,
    title: (session.title || "").trim() || DEFAULT_SESSION_TITLE,
    titleGenerationStatus: normalizedTitleGenerationStatus,
    titleGeneratedAt:
      normalizedTitleGenerationStatus === "generated"
        ? session.titleGeneratedAt || session.updatedAt
        : undefined,
    currentModelId: session.currentModelId,
    thinkingEnabled: session.thinkingEnabled,
    messages,
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
    pinned,
    pinnedAt: pinned ? session.pinnedAt || session.updatedAt : undefined,
    archived,
    archivedAt: archived ? session.archivedAt || session.updatedAt : undefined,
  };
}

export function reconcileSessionMetadata(
  metadata: SessionMetadata,
  session: SessionData | null | undefined
): SessionMetadata {
  if (!session) {
    return metadata;
  }

  const reconciled = buildSessionMetadata(session);
  if (
    reconciled.title === metadata.title &&
    reconciled.titleGenerationStatus === metadata.titleGenerationStatus &&
    reconciled.titleGeneratedAt === metadata.titleGeneratedAt &&
    Boolean(reconciled.pinned) === Boolean(metadata.pinned) &&
    Boolean(reconciled.archived) === Boolean(metadata.archived)
  ) {
    return metadata;
  }

  return reconciled;
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
    titleGenerationStatus: normalized.titleGenerationStatus,
    titleGeneratedAt: normalized.titleGeneratedAt,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    lastMessageAt: normalized.lastMessageAt,
    lastMessageId: normalized.lastMessageId,
    lastOpenedAt: normalized.lastOpenedAt,
    messageCount: normalized.messages.length,
    preview: getMessageTextPreview(normalized.messages),
    currentModelId: normalized.currentModelId,
    pinned: normalized.pinned,
    pinnedAt: normalized.pinnedAt,
    archived: normalized.archived,
    archivedAt: normalized.archivedAt,
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

      return normalizeSessionTiming(
        await hydrateSessionAttachments(session, attachments)
      );
    }
  );
}

export async function markSessionOpened(
  sessionId: string,
  openedAt: string
): Promise<void> {
  await withTransaction([SESSIONS_STORE, METADATA_STORE], "readwrite", async (stores) => {
    const [storedSessionResult, storedMetadataResult] = await Promise.all([
      requestToPromise(stores[SESSIONS_STORE].get(sessionId)),
      requestToPromise(stores[METADATA_STORE].get(sessionId)),
    ]);

    const storedSession = (storedSessionResult as SessionData | null) || null;
    const storedMetadata =
      (storedMetadataResult as SessionMetadata | null) || null;

    if (!storedSession && !storedMetadata) {
      return;
    }

    const normalizedSession = storedSession
      ? normalizeSessionTiming({
          ...storedSession,
          lastOpenedAt: openedAt,
        })
      : null;

    const metadata = normalizedSession
      ? buildSessionMetadata(normalizedSession)
      : storedMetadata
      ? {
          ...storedMetadata,
          lastOpenedAt: openedAt,
        }
      : null;

    await Promise.all([
      normalizedSession
        ? requestToPromise(
            stores[SESSIONS_STORE].put(
              JSON.parse(JSON.stringify(normalizedSession))
            )
          )
        : Promise.resolve(undefined),
      metadata
        ? requestToPromise(
            stores[METADATA_STORE].put(JSON.parse(JSON.stringify(metadata)))
          )
        : Promise.resolve(undefined),
    ]);
  });
}

async function patchStoredSession(
  sessionId: string,
  patch: (session: SessionData) => SessionData | null
): Promise<SessionMetadata | null> {
  return withTransaction(
    [SESSIONS_STORE, METADATA_STORE],
    "readwrite",
    async (stores) => {
      const stored = (await requestToPromise(
        stores[SESSIONS_STORE].get(sessionId)
      )) as SessionData | null;
      if (!stored) return null;

      const nextSession = patch(stored);
      if (!nextSession) return null;

      const normalized = normalizeSessionTiming(nextSession);
      const metadata = buildSessionMetadata(normalized);

      await Promise.all([
        requestToPromise(
          stores[SESSIONS_STORE].put(JSON.parse(JSON.stringify(normalized)))
        ),
        requestToPromise(
          stores[METADATA_STORE].put(JSON.parse(JSON.stringify(metadata)))
        ),
      ]);

      return metadata;
    }
  );
}

export async function renameSession(
  sessionId: string,
  rawTitle: string
): Promise<SessionMetadata | null> {
  const title = rawTitle.trim();
  if (!title) return null;

  const now = new Date().toISOString();
  return patchStoredSession(sessionId, (session) => ({
    ...session,
    title,
    titleGenerationStatus: "generated",
    titleGeneratedAt: now,
    updatedAt: now,
  }));
}

export async function setSessionPinned(
  sessionId: string,
  pinned: boolean
): Promise<SessionMetadata | null> {
  const now = new Date().toISOString();
  return patchStoredSession(sessionId, (session) => ({
    ...session,
    pinned,
    pinnedAt: pinned ? now : undefined,
    updatedAt: session.updatedAt,
  }));
}

export async function setSessionArchived(
  sessionId: string,
  archived: boolean
): Promise<SessionMetadata | null> {
  const now = new Date().toISOString();
  return patchStoredSession(sessionId, (session) => ({
    ...session,
    archived,
    archivedAt: archived ? now : undefined,
    updatedAt: session.updatedAt,
  }));
}

export async function listSessionMetadata(): Promise<SessionMetadata[]> {
  const metadata = await withTransaction([METADATA_STORE], "readonly", async (stores) => {
    const metadata = ((await requestToPromise(
      stores[METADATA_STORE].getAll()
    )) || []) as SessionMetadata[];

    return sortSessionMetadataByActivity(metadata);
  });

  const staleMetadata = metadata.filter((session) => {
    const trimmedTitle = (session.title || "").trim();
    return (
      !trimmedTitle ||
      trimmedTitle === DEFAULT_SESSION_TITLE ||
      session.titleGenerationStatus === undefined
    );
  });

  if (staleMetadata.length === 0) {
    return metadata;
  }

  return withTransaction([METADATA_STORE, SESSIONS_STORE], "readwrite", async (stores) => {
    const sessionsById = new Map(
      (
        await Promise.all(
          staleMetadata.map(async (session) => {
            const storedSession =
              ((await requestToPromise(
                stores[SESSIONS_STORE].get(session.id)
              )) as SessionData | null) || null;
            return [session.id, storedSession] as const;
          })
        )
      ).filter((entry): entry is readonly [string, SessionData] => Boolean(entry[1]))
    );

    const repairedMetadata = metadata.map((session) =>
      reconcileSessionMetadata(session, sessionsById.get(session.id))
    );

    const changedMetadata = repairedMetadata.filter(
      (session, index) =>
        session.title !== metadata[index].title ||
        session.titleGenerationStatus !== metadata[index].titleGenerationStatus ||
        session.titleGeneratedAt !== metadata[index].titleGeneratedAt
    );

    if (changedMetadata.length > 0) {
      await Promise.all(
        changedMetadata.map((session) =>
          requestToPromise(stores[METADATA_STORE].put(JSON.parse(JSON.stringify(session))))
        )
      );
    }

    return sortSessionMetadataByActivity(repairedMetadata);
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
    title: DEFAULT_SESSION_TITLE,
    titleGenerationStatus: "idle",
    currentModelId,
    thinkingEnabled: false,
    messages: [],
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
}
