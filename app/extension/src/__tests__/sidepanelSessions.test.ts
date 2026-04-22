import type {
  ChatMessage,
  SessionData,
  SessionMetadata,
} from "../sidepanel/types";
import {
  buildSessionMetadata,
  reconcileSessionMetadata,
} from "../sidepanel/sessionStorage";
import {
  DEFAULT_SESSION_TITLE,
  deriveSessionTitle,
  sortSessionMetadataByActivity,
} from "../sidepanel/utils/sessions";

function createUserMessage(text: string): ChatMessage {
  return {
    id: "message-1",
    role: "user",
    parts: [{ type: "text", text }],
    status: "complete",
  };
}

function createAssistantMessage(
  id: string,
  status: ChatMessage["status"],
  text = ""
): ChatMessage {
  return {
    id,
    role: "assistant",
    parts: text ? [{ type: "text", text }] : [],
    status,
  };
}

function createSession(
  id: string,
  overrides: Partial<SessionMetadata> = {}
): SessionMetadata {
  return {
    id,
    title: DEFAULT_SESSION_TITLE,
    titleGenerationStatus: "idle",
    createdAt: "2026-04-20T08:00:00.000Z",
    updatedAt: "2026-04-20T08:00:00.000Z",
    lastMessageAt: "2026-04-20T08:00:00.000Z",
    lastOpenedAt: "2026-04-20T08:00:00.000Z",
    messageCount: 1,
    preview: "",
    currentModelId: null,
    ...overrides,
  };
}

function createSessionData(
  id: string,
  overrides: Partial<SessionData> = {}
): SessionData {
  return {
    id,
    title: DEFAULT_SESSION_TITLE,
    titleGenerationStatus: "idle",
    currentModelId: null,
    thinkingEnabled: false,
    messages: [createUserMessage("Summarize the latest article about Rust")],
    createdAt: "2026-04-20T08:00:00.000Z",
    updatedAt: "2026-04-20T08:01:00.000Z",
    lastMessageAt: "2026-04-20T08:01:00.000Z",
    lastOpenedAt: "2026-04-20T08:01:00.000Z",
    ...overrides,
  };
}

describe("sidepanel session helpers", () => {
  it("derives a shortened title from the first user message", () => {
    const title = deriveSessionTitle(
      [createUserMessage(`  ${"A".repeat(80)}  `)],
      DEFAULT_SESSION_TITLE
    );

    expect(title).toBe(`${"A".repeat(39)}…`);
  });

  it("keeps persisted session titles at the default value before first-message derivation", () => {
    const metadata = buildSessionMetadata(createSessionData("session-1"));

    expect(metadata.title).toBe(DEFAULT_SESSION_TITLE);
    expect(metadata.titleGenerationStatus).toBe("idle");
  });

  it("keeps deriving the title from the first user message", () => {
    const title = deriveSessionTitle([
      createUserMessage("Generate a concise title now"),
      createAssistantMessage("pending-assistant", "running"),
      {
        id: "message-2",
        role: "user",
        parts: [{ type: "text", text: "A later user message should not rename the chat" }],
        status: "complete",
      },
    ]);

    expect(title).toBe("Generate a concise title now");
  });

  it("rebuilds stale metadata from the stored generated title", () => {
    const metadata = createSession("session-1");
    const session = createSessionData("session-1", {
      title: "Rust article summary",
      titleGenerationStatus: "generated",
      titleGeneratedAt: "2026-04-20T08:02:00.000Z",
    });

    const repaired = reconcileSessionMetadata(metadata, session);

    expect(repaired.title).toBe("Rust article summary");
    expect(repaired.titleGenerationStatus).toBe("generated");
    expect(repaired.titleGeneratedAt).toBe("2026-04-20T08:02:00.000Z");
  });

  it("keeps session ordering based on the last message time", () => {
    const ordered = sortSessionMetadataByActivity([
      createSession("older-message", {
        lastMessageAt: "2026-04-20T08:00:00.000Z",
        lastOpenedAt: "2026-04-22T10:00:00.000Z",
      }),
      createSession("newer-message", {
        lastMessageAt: "2026-04-21T08:00:00.000Z",
        lastOpenedAt: "2026-04-21T09:00:00.000Z",
      }),
    ]);

    expect(ordered.map((session) => session.id)).toEqual([
      "newer-message",
      "older-message",
    ]);
  });

  it("sorts pinned sessions above unpinned ones regardless of last-message time", () => {
    const ordered = sortSessionMetadataByActivity([
      createSession("newer-unpinned", {
        lastMessageAt: "2026-04-22T08:00:00.000Z",
      }),
      createSession("older-pinned", {
        lastMessageAt: "2026-04-20T08:00:00.000Z",
        pinned: true,
        pinnedAt: "2026-04-21T08:00:00.000Z",
      }),
    ]);

    expect(ordered.map((session) => session.id)).toEqual([
      "older-pinned",
      "newer-unpinned",
    ]);
  });

  it("orders multiple pinned sessions by most recently pinned", () => {
    const ordered = sortSessionMetadataByActivity([
      createSession("pinned-early", {
        pinned: true,
        pinnedAt: "2026-04-20T08:00:00.000Z",
      }),
      createSession("pinned-latest", {
        pinned: true,
        pinnedAt: "2026-04-22T08:00:00.000Z",
      }),
    ]);

    expect(ordered.map((session) => session.id)).toEqual([
      "pinned-latest",
      "pinned-early",
    ]);
  });

  it("exposes pinned and archived metadata when building from session data", () => {
    const metadata = buildSessionMetadata(
      createSessionData("session-pin", {
        pinned: true,
        pinnedAt: "2026-04-22T08:00:00.000Z",
        archived: true,
        archivedAt: "2026-04-22T08:05:00.000Z",
      })
    );

    expect(metadata.pinned).toBe(true);
    expect(metadata.pinnedAt).toBe("2026-04-22T08:00:00.000Z");
    expect(metadata.archived).toBe(true);
    expect(metadata.archivedAt).toBe("2026-04-22T08:05:00.000Z");
  });

  it("defaults pinned and archived fields to false when not set", () => {
    const metadata = buildSessionMetadata(createSessionData("session-default"));

    expect(metadata.pinned).toBe(false);
    expect(metadata.archived).toBe(false);
    expect(metadata.pinnedAt).toBeUndefined();
    expect(metadata.archivedAt).toBeUndefined();
  });

  it("reconciles metadata when pinned or archived flags diverge from the session", () => {
    const metadata = createSession("session-flip");
    const session = createSessionData("session-flip", {
      pinned: true,
      pinnedAt: "2026-04-22T08:00:00.000Z",
    });

    const repaired = reconcileSessionMetadata(metadata, session);

    expect(repaired.pinned).toBe(true);
    expect(repaired.pinnedAt).toBe("2026-04-22T08:00:00.000Z");
  });
});