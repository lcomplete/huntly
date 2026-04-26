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
    expect(messageRecords.size).toBe(2);

    const restored = await getSession("session-1");
    expect(restored?.messages.map((message) => message.id)).toEqual([
      "user-1",
      "assistant-1",
    ]);
  });

  it("only rewrites changed message rows on later saves", async () => {
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

  it("resets older chat stores before writing the current schema", async () => {
    const legacyDb = new FakeDatabase();
    legacyDb.version = 3;
    legacyDb.createObjectStore("sessions", { keyPath: "id" });
    legacyDb.createObjectStore("session-metadata", { keyPath: "id" });
    legacyDb.stores.get("sessions")!.records.set("legacy-session", {
      id: "legacy-session",
      messages: [],
    });
    legacyDb.stores.get("session-metadata")!.records.set("legacy-session", {
      id: "legacy-session",
      title: "Legacy chat",
      createdAt: "2026-04-24T08:00:00.000Z",
      updatedAt: "2026-04-24T08:00:00.000Z",
      messageCount: 0,
      preview: "",
      currentModelId: null,
    });
    fakeIndexedDB.databases.set("huntly-agent", legacyDb);

    const { listSessionMetadata, saveSession } = await import(
      "../sidepanel/sessionStorage"
    );

    await saveSession(createSession("Question", "Answer"));

    const db = fakeIndexedDB.databases.get("huntly-agent")!;
    expect(db.version).toBe(4);
    expect(db.stores.get("sessions")!.records.has("legacy-session")).toBe(
      false
    );
    expect(
      db.stores.get("session-metadata")!.records.has("legacy-session")
    ).toBe(false);

    const metadata = await listSessionMetadata();
    expect(metadata.map((session) => session.id)).toEqual(["session-1"]);
    expect(metadata[0].preview).toBe("Question\nAnswer");
  });
});
