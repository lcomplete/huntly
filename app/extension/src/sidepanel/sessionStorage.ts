/**
 * IndexedDB session storage — split-store pattern.
 *
 * Four object stores:
 * - `sessions`: Session header data plus message refs
 * - `session-messages`: Individual chat messages
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
const DB_VERSION = 4;
const SPLIT_STORES_DB_VERSION = 4;
const SESSION_RECORD_SCHEMA_VERSION = 4;
const SESSIONS_STORE = "sessions";
const SESSION_MESSAGES_STORE = "session-messages";
const METADATA_STORE = "session-metadata";
const ATTACHMENTS_STORE = "session-attachments";
const MESSAGES_BY_SESSION_INDEX = "by-sessionId";
const ATTACHMENTS_BY_SESSION_INDEX = "by-sessionId";

type StoredMessageRef = {
  storageKey: string;
  messageId: string;
  order: number;
};

type StoredSessionRecord = Omit<SessionData, "messages"> & {
  schemaVersion: typeof SESSION_RECORD_SCHEMA_VERSION;
  messageRefs: StoredMessageRef[];
};

type SessionHeader = Omit<SessionData, "messages">;

type StoredMessageRecord = {
  storageKey: string;
  sessionId: string;
  messageId: string;
  order: number;
  message: ChatMessage;
  updatedAt: string;
};

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

function ensureObjectStores(
  db: IDBDatabase,
  transaction: IDBTransaction
): void {
  if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
    db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains(METADATA_STORE)) {
    db.createObjectStore(METADATA_STORE, { keyPath: "id" });
  }

  const messagesStore = db.objectStoreNames.contains(SESSION_MESSAGES_STORE)
    ? transaction.objectStore(SESSION_MESSAGES_STORE)
    : db.createObjectStore(SESSION_MESSAGES_STORE, {
        keyPath: "storageKey",
      });

  if (!messagesStore.indexNames.contains(MESSAGES_BY_SESSION_INDEX)) {
    messagesStore.createIndex(MESSAGES_BY_SESSION_INDEX, "sessionId", {
      unique: false,
    });
  }

  const attachmentsStore = db.objectStoreNames.contains(ATTACHMENTS_STORE)
    ? transaction.objectStore(ATTACHMENTS_STORE)
    : db.createObjectStore(ATTACHMENTS_STORE, { keyPath: "id" });

  if (!attachmentsStore.indexNames.contains(ATTACHMENTS_BY_SESSION_INDEX)) {
    attachmentsStore.createIndex(ATTACHMENTS_BY_SESSION_INDEX, "sessionId", {
      unique: false,
    });
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = event.oldVersion;
        const transaction = request.transaction!;

        ensureObjectStores(db, transaction);

        if (oldVersion > 0 && oldVersion < SPLIT_STORES_DB_VERSION) {
          migrateLegacySessionRecords(transaction);
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

function getLatestMessage(messages: ChatMessage[]): ChatMessage | null {
  return messages.length > 0 ? messages[messages.length - 1] : null;
}

function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getMessageId(message: ChatMessage, order: number): string {
  return message.id || `message-${order}`;
}

function getMessageStorageKey(sessionId: string, messageId: string): string {
  return `${sessionId}\u001f${messageId}`;
}

function getFallbackAttachmentId(
  sessionId: string,
  messageId: string,
  partIndex: number
): string {
  return `${sessionId}\u001f${messageId}\u001fattachment-${partIndex}`;
}

function createMessageRef(
  sessionId: string,
  message: ChatMessage,
  order: number
): StoredMessageRef {
  const messageId = getMessageId(message, order);
  return {
    storageKey: getMessageStorageKey(sessionId, messageId),
    messageId,
    order,
  };
}

function createMessageRecord(
  sessionId: string,
  message: ChatMessage,
  order: number,
  updatedAt: string
): StoredMessageRecord {
  const ref = createMessageRef(sessionId, message, order);
  return {
    ...ref,
    sessionId,
    message,
    updatedAt,
  };
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
    rollingSummary: session.rollingSummary,
    messages,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastMessageAt:
      session.lastMessageAt || (latestMessage ? session.updatedAt : undefined),
    lastMessageId: session.lastMessageId || latestMessage?.id,
    lastOpenedAt:
      session.lastOpenedAt || session.updatedAt || session.createdAt,
    pinned,
    pinnedAt: pinned ? session.pinnedAt || session.updatedAt : undefined,
    archived,
    archivedAt: archived ? session.archivedAt || session.updatedAt : undefined,
  };
}

function normalizeStoredSessionRecord(
  record: StoredSessionRecord
): StoredSessionRecord {
  const normalizedTitleGenerationStatus = normalizeTitleGenerationStatus(
    record.titleGenerationStatus
  );
  const pinned = Boolean(record.pinned);
  const archived = Boolean(record.archived);
  const latestRef = record.messageRefs[record.messageRefs.length - 1];

  return {
    id: record.id,
    title: (record.title || "").trim() || DEFAULT_SESSION_TITLE,
    titleGenerationStatus: normalizedTitleGenerationStatus,
    titleGeneratedAt:
      normalizedTitleGenerationStatus === "generated"
        ? record.titleGeneratedAt || record.updatedAt
        : undefined,
    currentModelId: record.currentModelId ?? null,
    thinkingEnabled: Boolean(record.thinkingEnabled),
    rollingSummary: record.rollingSummary,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastMessageAt: record.lastMessageAt,
    lastMessageId: record.lastMessageId || latestRef?.messageId,
    lastOpenedAt: record.lastOpenedAt || record.updatedAt || record.createdAt,
    pinned,
    pinnedAt: pinned ? record.pinnedAt || record.updatedAt : undefined,
    archived,
    archivedAt: archived ? record.archivedAt || record.updatedAt : undefined,
    schemaVersion: SESSION_RECORD_SCHEMA_VERSION,
    messageRefs: record.messageRefs,
  };
}

function createStoredSessionRecord(
  session: SessionData,
  messageRefs: StoredMessageRef[]
): StoredSessionRecord {
  const { messages: _messages, ...header } = session;
  return normalizeStoredSessionRecord({
    ...header,
    schemaVersion: SESSION_RECORD_SCHEMA_VERSION,
    messageRefs,
  });
}

function createSessionDataFromRecord(
  record: StoredSessionRecord,
  messages: ChatMessage[]
): SessionData {
  const {
    schemaVersion: _schemaVersion,
    messageRefs: _messageRefs,
    ...header
  } = normalizeStoredSessionRecord(record);
  return {
    ...header,
    messages,
  };
}

function getSessionHeader(record: StoredSessionRecord): SessionHeader {
  const {
    schemaVersion: _schemaVersion,
    messageRefs: _messageRefs,
    ...header
  } = normalizeStoredSessionRecord(record);
  return header;
}

function applySessionHeader(
  record: StoredSessionRecord,
  header: SessionHeader
): StoredSessionRecord {
  return normalizeStoredSessionRecord({
    ...record,
    ...header,
  });
}

function buildMetadataFromStoredRecord(
  record: StoredSessionRecord,
  existingMetadata?: SessionMetadata | null
): SessionMetadata {
  const normalized = normalizeStoredSessionRecord(record);
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
    messageCount:
      existingMetadata?.messageCount ?? normalized.messageRefs.length,
    preview: existingMetadata?.preview ?? "",
    currentModelId: normalized.currentModelId,
    pinned: normalized.pinned,
    pinnedAt: normalized.pinnedAt,
    archived: normalized.archived,
    archivedAt: normalized.archivedAt,
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
    session.messages.map(async (message, messageOrder) => ({
      ...message,
      parts: await Promise.all(
        message.parts.map(async (part, partIndex) => {
          if (part.type !== "file") return part;

          const attachmentId =
            part.attachmentId ||
            getFallbackAttachmentId(
              session.id,
              getMessageId(message, messageOrder),
              partIndex
            );
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

async function getMessageKeysForSession(
  messageStore: IDBObjectStore,
  sessionId: string
): Promise<string[]> {
  const index = messageStore.index(MESSAGES_BY_SESSION_INDEX);
  const keys = (await requestToPromise(
    index.getAllKeys(sessionId)
  )) as IDBValidKey[];

  return keys.map((key) => String(key));
}

async function getMessagesFromRefs(
  messageStore: IDBObjectStore,
  record: StoredSessionRecord
): Promise<ChatMessage[]> {
  const normalized = normalizeStoredSessionRecord(record);
  const messageRecords = await Promise.all(
    normalized.messageRefs.map(async (ref) => {
      return ((await requestToPromise(messageStore.get(ref.storageKey))) ||
        null) as StoredMessageRecord | null;
    })
  );

  return messageRecords
    .map((messageRecord, index) => {
      const ref = normalized.messageRefs[index];
      if (!messageRecord) {
        throw new Error(`Missing stored message ${ref.messageId}`);
      }
      return {
        message: messageRecord.message,
        order: ref.order,
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.message);
}

async function hydrateSessionAttachments(
  session: SessionData,
  attachments: StoredAttachmentRecord[]
): Promise<SessionData> {
  const attachmentMap = new Map(
    attachments.map((attachment) => [attachment.id, attachment])
  );
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

function isLegacySessionRecord(record: unknown): record is SessionData {
  return Boolean(
    record &&
      typeof record === "object" &&
      Array.isArray((record as { messages?: unknown }).messages)
  );
}

function buildStoredSessionArtifacts(session: SessionData): {
  sessionRecord: StoredSessionRecord;
  metadata: SessionMetadata;
  messageRecords: StoredMessageRecord[];
} {
  const safeMessages = toJsonSafe(session.messages);
  const safeSession: SessionData = {
    ...session,
    messages: safeMessages,
  };
  const messageRecords = safeMessages.map((message, order) =>
    createMessageRecord(safeSession.id, message, order, safeSession.updatedAt)
  );
  const messageRefs = messageRecords.map(
    ({ storageKey, messageId, order }) => ({
      storageKey,
      messageId,
      order,
    })
  );

  return {
    sessionRecord: createStoredSessionRecord(safeSession, messageRefs),
    metadata: buildSessionMetadata(safeSession),
    messageRecords,
  };
}

function getFirstMessageRefDivergenceIndex(
  existingRefs: StoredMessageRef[],
  messageRecords: StoredMessageRecord[]
): number {
  const comparableLength = Math.min(existingRefs.length, messageRecords.length);

  for (let index = 0; index < comparableLength; index += 1) {
    const existingRef = existingRefs[index];
    const messageRecord = messageRecords[index];
    if (
      existingRef.storageKey !== messageRecord.storageKey ||
      existingRef.messageId !== messageRecord.messageId ||
      existingRef.order !== messageRecord.order
    ) {
      return index;
    }
  }

  return existingRefs.length === messageRecords.length ? -1 : comparableLength;
}

function getMessageRecordsToPut(
  existingRefs: StoredMessageRef[],
  messageRecords: StoredMessageRecord[]
): StoredMessageRecord[] {
  if (messageRecords.length === 0) {
    return [];
  }

  const divergenceIndex = getFirstMessageRefDivergenceIndex(
    existingRefs,
    messageRecords
  );

  if (divergenceIndex !== -1) {
    return messageRecords.slice(divergenceIndex);
  }

  return [messageRecords[messageRecords.length - 1]];
}

function migrateLegacySessionRecords(transaction: IDBTransaction): void {
  const sessionStore = transaction.objectStore(SESSIONS_STORE);
  const messageStore = transaction.objectStore(SESSION_MESSAGES_STORE);
  const metadataStore = transaction.objectStore(METADATA_STORE);
  const getAllSessionsRequest = sessionStore.getAll();

  getAllSessionsRequest.onsuccess = () => {
    const storedSessions = (getAllSessionsRequest.result || []) as unknown[];

    storedSessions.forEach((storedSession) => {
      if (!isLegacySessionRecord(storedSession)) {
        return;
      }

      const artifacts = buildStoredSessionArtifacts(
        normalizeSessionTiming(storedSession)
      );

      sessionStore.put(toJsonSafe(artifacts.sessionRecord));
      metadataStore.put(toJsonSafe(artifacts.metadata));
      artifacts.messageRecords.forEach((messageRecord) => {
        messageStore.put(toJsonSafe(messageRecord));
      });
    });
  };
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function saveSession(session: SessionData): Promise<void> {
  const normalizedSession = normalizeSessionTiming(session);
  const serialized = await serializeSessionAttachments(normalizedSession);
  const { messageRecords, metadata, sessionRecord } =
    buildStoredSessionArtifacts(serialized.session);
  const safeSessionRecord = toJsonSafe(sessionRecord);
  const safeMetadata = toJsonSafe(metadata);
  const safeMessageRecords = toJsonSafe(messageRecords);
  await withTransaction(
    [SESSIONS_STORE, SESSION_MESSAGES_STORE, METADATA_STORE, ATTACHMENTS_STORE],
    "readwrite",
    async (stores) => {
      const existingSession =
        ((await requestToPromise(
          stores[SESSIONS_STORE].get(safeSessionRecord.id)
        )) as StoredSessionRecord | null) || null;
      const existingRefs = existingSession ? existingSession.messageRefs : [];
      const nextMessageKeys = new Set(
        safeMessageRecords.map((messageRecord) => messageRecord.storageKey)
      );
      const removedMessageKeys = existingRefs
        .map((ref) => ref.storageKey)
        .filter((key) => !nextMessageKeys.has(key));
      const messageRecordsToPut = getMessageRecordsToPut(
        existingRefs,
        safeMessageRecords
      );

      const existingAttachmentIds = await getAttachmentIdsForSession(
        stores[ATTACHMENTS_STORE],
        safeSessionRecord.id
      );
      const removedAttachmentIds = existingAttachmentIds.filter(
        (id) => !serialized.referencedAttachmentIds.has(id)
      );

      await Promise.all([
        requestToPromise(stores[SESSIONS_STORE].put(safeSessionRecord)),
        requestToPromise(stores[METADATA_STORE].put(safeMetadata)),
        ...messageRecordsToPut.map((messageRecord) =>
          requestToPromise(stores[SESSION_MESSAGES_STORE].put(messageRecord))
        ),
        ...removedMessageKeys.map((messageKey) =>
          requestToPromise(stores[SESSION_MESSAGES_STORE].delete(messageKey))
        ),
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
    [SESSIONS_STORE, SESSION_MESSAGES_STORE, ATTACHMENTS_STORE],
    "readonly",
    async (stores) => {
      const storedSession =
        ((await requestToPromise(
          stores[SESSIONS_STORE].get(sessionId)
        )) as StoredSessionRecord | null) || null;

      if (!storedSession) return null;

      const session = createSessionDataFromRecord(
        storedSession,
        await getMessagesFromRefs(stores[SESSION_MESSAGES_STORE], storedSession)
      );

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
  await withTransaction(
    [SESSIONS_STORE, METADATA_STORE],
    "readwrite",
    async (stores) => {
      const [storedSessionResult, storedMetadataResult] = await Promise.all([
        requestToPromise(stores[SESSIONS_STORE].get(sessionId)),
        requestToPromise(stores[METADATA_STORE].get(sessionId)),
      ]);

      const storedSession =
        (storedSessionResult as StoredSessionRecord | null) || null;
      const storedMetadata =
        (storedMetadataResult as SessionMetadata | null) || null;

      if (!storedSession) {
        return;
      }

      const normalizedSession = normalizeStoredSessionRecord({
        ...storedSession,
        lastOpenedAt: openedAt,
      });
      const metadata = buildMetadataFromStoredRecord(
        normalizedSession,
        storedMetadata
      );

      await Promise.all([
        requestToPromise(
          stores[SESSIONS_STORE].put(toJsonSafe(normalizedSession))
        ),
        requestToPromise(stores[METADATA_STORE].put(toJsonSafe(metadata))),
      ]);
    }
  );
}

async function patchStoredSession(
  sessionId: string,
  patch: (session: SessionHeader) => SessionHeader | null
): Promise<SessionMetadata | null> {
  return withTransaction(
    [SESSIONS_STORE, METADATA_STORE],
    "readwrite",
    async (stores) => {
      const [storedResult, storedMetadataResult] = await Promise.all([
        requestToPromise(stores[SESSIONS_STORE].get(sessionId)),
        requestToPromise(stores[METADATA_STORE].get(sessionId)),
      ]);

      const stored = (storedResult as StoredSessionRecord | null) || null;
      const storedMetadata =
        (storedMetadataResult as SessionMetadata | null) || null;

      if (!stored) return null;

      const nextHeader = patch(getSessionHeader(stored));
      if (!nextHeader) return null;

      const normalized = applySessionHeader(stored, nextHeader);
      const metadata = buildMetadataFromStoredRecord(
        normalized,
        storedMetadata
      );

      await Promise.all([
        requestToPromise(stores[SESSIONS_STORE].put(toJsonSafe(normalized))),
        requestToPromise(stores[METADATA_STORE].put(toJsonSafe(metadata))),
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
  return withTransaction([METADATA_STORE], "readonly", async (stores) => {
    const metadata = ((await requestToPromise(
      stores[METADATA_STORE].getAll()
    )) || []) as SessionMetadata[];

    return sortSessionMetadataByActivity(metadata);
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await withTransaction(
    [SESSIONS_STORE, SESSION_MESSAGES_STORE, METADATA_STORE, ATTACHMENTS_STORE],
    "readwrite",
    async (stores) => {
      const messageKeys = await getMessageKeysForSession(
        stores[SESSION_MESSAGES_STORE],
        sessionId
      );
      const attachmentIds = await getAttachmentIdsForSession(
        stores[ATTACHMENTS_STORE],
        sessionId
      );

      await Promise.all([
        requestToPromise(stores[SESSIONS_STORE].delete(sessionId)),
        requestToPromise(stores[METADATA_STORE].delete(sessionId)),
        ...messageKeys.map((messageKey) =>
          requestToPromise(stores[SESSION_MESSAGES_STORE].delete(messageKey))
        ),
        ...attachmentIds.map((attachmentId) =>
          requestToPromise(stores[ATTACHMENTS_STORE].delete(attachmentId))
        ),
      ]);
    }
  );
}

export function createEmptySession(
  currentModelId: string | null,
  id?: string
): SessionData {
  const now = new Date().toISOString();
  return {
    id: id ?? crypto.randomUUID(),
    title: DEFAULT_SESSION_TITLE,
    titleGenerationStatus: "idle",
    currentModelId,
    thinkingEnabled: false,
    rollingSummary: undefined,
    messages: [],
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
}
