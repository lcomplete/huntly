import { beforeEach, describe, expect, it, jest } from "@jest/globals";

type FakeRequest<T> = {
  result?: T;
  error?: Error;
  onsuccess?: () => void;
  onerror?: () => void;
};

function createRequest<T>(run: () => T): IDBRequest<T> {
  const request: FakeRequest<T> = {};
  queueMicrotask(() => {
    try {
      request.result = run();
      request.onsuccess?.();
    } catch (error) {
      request.error = error as Error;
      request.onerror?.();
    }
  });
  return request as unknown as IDBRequest<T>;
}

class FakeNameList {
  constructor(private readonly names: () => string[]) {}

  contains(name: string): boolean {
    return this.names().includes(name);
  }
}

class FakeObjectStoreDefinition {
  readonly records = new Map<string, unknown>();
  readonly indexes = new Map<string, string>();
  readonly indexNames = new FakeNameList(() => Array.from(this.indexes.keys()));
  putCount = 0;

  constructor(readonly keyPath: string) {}
}

class FakeIndex {
  constructor(
    private readonly definition: FakeObjectStoreDefinition,
    private readonly keyPath: string
  ) {}

  getAll(query: IDBValidKey): IDBRequest<unknown[]> {
    return createRequest(() =>
      Array.from(this.definition.records.values()).filter(
        (record) => (record as Record<string, unknown>)[this.keyPath] === query
      )
    );
  }

  getAllKeys(query: IDBValidKey): IDBRequest<IDBValidKey[]> {
    return createRequest<IDBValidKey[]>(() =>
      Array.from(this.definition.records.entries())
        .filter(
          ([, record]) =>
            (record as Record<string, unknown>)[this.keyPath] === query
        )
        .map(([key]) => key as IDBValidKey)
    );
  }
}

class FakeObjectStore {
  readonly indexNames: FakeNameList;

  constructor(private readonly definition: FakeObjectStoreDefinition) {
    this.indexNames = definition.indexNames;
  }

  createIndex(name: string, keyPath: string): FakeIndex {
    this.definition.indexes.set(name, keyPath);
    return new FakeIndex(this.definition, keyPath);
  }

  index(name: string): FakeIndex {
    const keyPath = this.definition.indexes.get(name);
    if (!keyPath) {
      throw new Error(`Missing index ${name}`);
    }
    return new FakeIndex(this.definition, keyPath);
  }

  get(key: IDBValidKey): IDBRequest<unknown> {
    return createRequest(() => this.definition.records.get(String(key)));
  }

  getAll(): IDBRequest<unknown[]> {
    return createRequest(() => Array.from(this.definition.records.values()));
  }

  put(value: unknown): IDBRequest<IDBValidKey> {
    return createRequest<IDBValidKey>(() => {
      const key = String(
        (value as Record<string, unknown>)[this.definition.keyPath]
      );
      this.definition.records.set(key, value);
      this.definition.putCount += 1;
      return key as IDBValidKey;
    });
  }

  delete(key: IDBValidKey): IDBRequest<undefined> {
    return createRequest(() => {
      this.definition.records.delete(String(key));
      return undefined;
    });
  }
}

class FakeTransaction {
  private completeHandler?: () => void;

  constructor(private readonly db: FakeDatabase) {}

  set oncomplete(handler: (() => void) | null) {
    this.completeHandler = handler || undefined;
    if (handler) {
      queueMicrotask(handler);
    }
  }

  get oncomplete(): (() => void) | null {
    return this.completeHandler || null;
  }

  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  error: Error | null = null;

  objectStore(name: string): FakeObjectStore {
    return this.db.objectStore(name);
  }

  abort(): void {
    this.onabort?.();
  }
}

class FakeDatabase {
  version = 0;
  readonly stores = new Map<string, FakeObjectStoreDefinition>();
  readonly objectStoreNames = new FakeNameList(() =>
    Array.from(this.stores.keys())
  );

  createObjectStore(
    name: string,
    options: { keyPath: string }
  ): FakeObjectStore {
    const definition = new FakeObjectStoreDefinition(options.keyPath);
    this.stores.set(name, definition);
    return new FakeObjectStore(definition);
  }

  deleteObjectStore(name: string): void {
    this.stores.delete(name);
  }

  objectStore(name: string): FakeObjectStore {
    const definition = this.stores.get(name);
    if (!definition) {
      throw new Error(`Missing object store ${name}`);
    }
    return new FakeObjectStore(definition);
  }

  transaction(): FakeTransaction {
    return new FakeTransaction(this);
  }
}

class FakeIndexedDB {
  readonly databases = new Map<string, FakeDatabase>();

  open(name: string, version?: number): IDBOpenDBRequest {
    const request: FakeRequest<FakeDatabase> & {
      onupgradeneeded?: (event: IDBVersionChangeEvent) => void;
    } = {};
    queueMicrotask(() => {
      let db = this.databases.get(name);
      const requestedVersion = version || 1;
      const oldVersion = db?.version || 0;
      if (!db) {
        db = new FakeDatabase();
        this.databases.set(name, db);
      }
      request.result = db;
      if (requestedVersion > oldVersion) {
        db.version = requestedVersion;
        (request as unknown as { transaction: FakeTransaction }).transaction =
          db.transaction();
        request.onupgradeneeded?.({ oldVersion } as IDBVersionChangeEvent);
      }
      request.onsuccess?.();
    });
    return request as unknown as IDBOpenDBRequest;
  }
}

function createSession(text: string, assistantText = "Hello") {
  return {
    id: "session-1",
    title: "Untitled chat",
    titleGenerationStatus: "idle" as const,
    currentModelId: null,
    thinkingEnabled: false,
    messages: [
      {
        id: "user-1",
        role: "user" as const,
        parts: [{ type: "text" as const, text }],
        status: "complete" as const,
      },
      {
        id: "assistant-1",
        role: "assistant" as const,
        parts: [{ type: "text" as const, text: assistantText }],
        status: "running" as const,
      },
    ],
    createdAt: "2026-04-25T08:00:00.000Z",
    updatedAt: "2026-04-25T08:00:01.000Z",
    lastMessageAt: "2026-04-25T08:00:01.000Z",
    lastOpenedAt: "2026-04-25T08:00:01.000Z",
  };
}

function createRunningSession(text: string) {
  return {
    ...createSession(text, ""),
    messages: [
      {
        id: "user-1",
        role: "user" as const,
        parts: [{ type: "text" as const, text }],
        status: "complete" as const,
      },
      {
        id: "pending-assistant",
        role: "assistant" as const,
        parts: [],
        status: "running" as const,
      },
    ],
  };
}

function createTwoTurnSession(secondQuestion = "Follow-up") {
  return {
    ...createSession("Question", "First answer"),
    messages: [
      {
        id: "user-1",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Question" }],
        status: "complete" as const,
      },
      {
        id: "assistant-1",
        role: "assistant" as const,
        parts: [{ type: "text" as const, text: "First answer" }],
        status: "complete" as const,
      },
      {
        id: "user-2",
        role: "user" as const,
        parts: [{ type: "text" as const, text: secondQuestion }],
        status: "complete" as const,
      },
      {
        id: "assistant-2",
        role: "assistant" as const,
        parts: [{ type: "text" as const, text: "Second answer" }],
        status: "complete" as const,
      },
    ],
  };
}

function createTwoTurnSessionWithAttachment(secondAnswer = "Second answer") {
  return {
    ...createSession("Question", "First answer"),
    messages: [
      {
        id: "user-1",
        role: "user" as const,
        parts: [
          { type: "text" as const, text: "Question" },
          {
            type: "file" as const,
            filename: "note.txt",
            mediaType: "text/plain",
            dataUrl: "data:text/plain;base64,SGVsbG8=",
            size: 5,
          },
        ],
        status: "complete" as const,
      },
      {
        id: "assistant-1",
        role: "assistant" as const,
        parts: [{ type: "text" as const, text: "First answer" }],
        status: "complete" as const,
      },
      {
        id: "user-2",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Follow-up" }],
        status: "complete" as const,
      },
      {
        id: "assistant-2",
        role: "assistant" as const,
        parts: [{ type: "text" as const, text: secondAnswer }],
        status: "complete" as const,
      },
    ],
  };
}

describe("sessionStorage persistence layout", () => {
  let fakeIndexedDB: FakeIndexedDB;

  beforeEach(() => {
    jest.resetModules();
    fakeIndexedDB = new FakeIndexedDB();
    (globalThis as typeof globalThis & { indexedDB: IDBFactory }).indexedDB =
      fakeIndexedDB as unknown as IDBFactory;
  });

  it("stores the session header separately from message rows", async () => {
    const { getSession, saveSession } = await import(
      "../sidepanel/sessionStorage"
    );

    await saveSession(createSession("Question"));

    const db = fakeIndexedDB.databases.get("huntly-agent")!;
    const sessionRecord = db.stores
      .get("sessions")!
      .records.get("session-1") as Record<string, unknown>;
    const messageRecords = db.stores.get("session-messages")!.records;

    expect(sessionRecord.schemaVersion).toBe(4);
    expect(sessionRecord.messages).toBeUndefined();
    expect(sessionRecord.messageRefs).toHaveLength(2);
    expect(sessionRecord.messageRefs).toEqual([
      expect.not.objectContaining({ signature: expect.anything() }),
      expect.not.objectContaining({ signature: expect.anything() }),
    ]);
    expect(messageRecords.size).toBe(2);
    expect(Array.from(messageRecords.values())).toEqual([
      expect.not.objectContaining({ signature: expect.anything() }),
      expect.not.objectContaining({ signature: expect.anything() }),
    ]);

    const restored = await getSession("session-1");
    expect(restored?.messages.map((message) => message.id)).toEqual([
      "user-1",
      "assistant-1",
    ]);
  });

  it("only rewrites the latest message row on streaming saves", async () => {
    const { saveSession } = await import("../sidepanel/sessionStorage");

    await saveSession(createSession("Question", "First chunk"));

    const db = fakeIndexedDB.databases.get("huntly-agent")!;
    const messageStore = db.stores.get("session-messages")!;
    messageStore.putCount = 0;

    await saveSession(createSession("Question", "Second chunk"));

    expect(messageStore.putCount).toBe(1);
    const records = Array.from(messageStore.records.values()) as Array<{
      message: { id: string; parts: Array<{ text?: string }> };
    }>;
    expect(
      records.find((record) => record.message.id === "assistant-1")?.message
        .parts[0].text
    ).toBe("Second chunk");
  });

  it("rewrites only the divergent suffix after a history edit", async () => {
    const { saveSession } = await import("../sidepanel/sessionStorage");

    await saveSession(createTwoTurnSession());

    const db = fakeIndexedDB.databases.get("huntly-agent")!;
    const messageStore = db.stores.get("session-messages")!;
    messageStore.putCount = 0;

    const edited = createTwoTurnSession("Edited follow-up");
    edited.messages[2] = {
      ...edited.messages[2],
      id: "user-2-edited",
    };
    edited.messages[3] = {
      ...edited.messages[3],
      id: "assistant-2-edited",
    };

    await saveSession(edited);

    expect(messageStore.putCount).toBe(2);
    const storedIds = Array.from(messageStore.records.values()).map(
      (record) => (record as { message: { id: string } }).message.id
    );
    expect(storedIds).toEqual([
      "user-1",
      "assistant-1",
      "user-2-edited",
      "assistant-2-edited",
    ]);
  });

  it("keeps earlier attachment refs stable when only the latest message rewrites", async () => {
    const { saveSession } = await import("../sidepanel/sessionStorage");
    const originalFetch = globalThis.fetch;

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      blob: async () =>
        ({ size: 5, type: "text/plain" }) as unknown as Blob,
    })) as unknown as typeof fetch;

    try {
      await saveSession(createTwoTurnSessionWithAttachment());

      const db = fakeIndexedDB.databases.get("huntly-agent")!;
      const messageStore = db.stores.get("session-messages")!;
      const attachmentStore = db.stores.get("session-attachments")!;
      const storedUserMessage = messageStore.records.get(
        "session-1\u001fuser-1"
      ) as {
        message: { parts: Array<{ type: string; attachmentId?: string }> };
      };
      const firstAttachmentId = storedUserMessage.message.parts[1].attachmentId;

      expect(firstAttachmentId).toBeDefined();
      expect(attachmentStore.records.has(firstAttachmentId!)).toBe(true);

      messageStore.putCount = 0;

      await saveSession(
        createTwoTurnSessionWithAttachment("Updated second answer")
      );

      expect(messageStore.putCount).toBe(1);

      const updatedUserMessage = messageStore.records.get(
        "session-1\u001fuser-1"
      ) as {
        message: { parts: Array<{ type: string; attachmentId?: string }> };
      };
      const updatedAttachmentId =
        updatedUserMessage.message.parts[1].attachmentId;

      expect(updatedAttachmentId).toBe(firstAttachmentId);
      expect(Array.from(attachmentStore.records.keys())).toEqual([
        firstAttachmentId,
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps history metadata and stored messages after a run completes", async () => {
    const { getSession, listSessionMetadata, saveSession } = await import(
      "../sidepanel/sessionStorage"
    );

    await saveSession(createRunningSession("Question"));

    const runningMetadata = await listSessionMetadata();
    expect(runningMetadata[0].messageCount).toBe(2);
    expect(runningMetadata[0].preview).toBe("Question");

    await saveSession(createSession("Question", "Final answer"));

    const completedMetadata = await listSessionMetadata();
    expect(completedMetadata[0].messageCount).toBe(2);
    expect(completedMetadata[0].preview).toBe("Question\nFinal answer");

    const restored = await getSession("session-1");
    expect(restored?.messages).toHaveLength(2);
    expect(restored?.messages[1].id).toBe("assistant-1");
    expect(restored?.messages[1].parts[0].text).toBe("Final answer");
  });

  it("migrates older chat stores without dropping persisted data", async () => {
    const legacyDb = new FakeDatabase();
    legacyDb.version = 2;
    legacyDb.createObjectStore("sessions", { keyPath: "id" });
    legacyDb.createObjectStore("session-metadata", { keyPath: "id" });
    legacyDb.createObjectStore("session-attachments", { keyPath: "id" });
    legacyDb.stores.get("sessions")!.records.set("legacy-session", {
      ...createSession("Legacy question", "Legacy answer"),
      id: "legacy-session",
      title: "Legacy chat",
      createdAt: "2026-04-24T08:00:00.000Z",
      updatedAt: "2026-04-24T08:00:01.000Z",
      lastMessageAt: "2026-04-24T08:00:01.000Z",
      lastOpenedAt: "2026-04-24T08:00:01.000Z",
    });
    legacyDb.stores.get("session-metadata")!.records.set("legacy-session", {
      id: "legacy-session",
      title: "Legacy chat",
      createdAt: "2026-04-24T08:00:00.000Z",
      updatedAt: "2026-04-24T08:00:01.000Z",
      messageCount: 2,
      preview: "",
      currentModelId: null,
    });
    legacyDb.stores
      .get("session-attachments")!
      .records.set("legacy-attachment", {
        id: "legacy-attachment",
        sessionId: "legacy-session",
        blob: { size: 17, type: "text/plain" } as unknown as Blob,
        createdAt: "2026-04-24T08:00:01.000Z",
        mediaType: "text/plain",
        size: 17,
      });
    fakeIndexedDB.databases.set("huntly-agent", legacyDb);

    const { getSession, listSessionMetadata, saveSession } = await import(
      "../sidepanel/sessionStorage"
    );

    const db = fakeIndexedDB.databases.get("huntly-agent")!;
    const restoredLegacy = await getSession("legacy-session");

    expect(db.version).toBe(4);
    const migratedSession = db.stores
      .get("sessions")!
      .records.get("legacy-session") as Record<string, unknown>;
    expect(migratedSession.messages).toBeUndefined();
    expect(migratedSession.messageRefs).toHaveLength(2);
    expect(db.stores.get("session-messages")!.records.size).toBe(2);
    expect(
      db.stores.get("session-attachments")!.records.has("legacy-attachment")
    ).toBe(true);

    expect(restoredLegacy?.title).toBe("Legacy chat");
    expect(restoredLegacy?.messages.map((message) => message.id)).toEqual([
      "user-1",
      "assistant-1",
    ]);
    expect(restoredLegacy?.messages[1].parts[0].text).toBe("Legacy answer");

    const metadata = await listSessionMetadata();
    expect(metadata).toHaveLength(1);
    expect(metadata[0].id).toBe("legacy-session");
    expect(metadata[0].preview).toBe("Legacy question\nLegacy answer");

    await saveSession(createSession("Question", "Answer"));

    const mergedMetadata = await listSessionMetadata();
    expect(mergedMetadata).toHaveLength(2);
    expect(mergedMetadata.map((session) => session.id)).toEqual(
      expect.arrayContaining(["legacy-session", "session-1"])
    );
    expect(
      (await getSession("legacy-session"))?.messages[1].parts[0].text
    ).toBe("Legacy answer");
  });
});
