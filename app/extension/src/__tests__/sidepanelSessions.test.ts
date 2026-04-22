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

  it("keeps persisted session titles at the default value before LLM generation", () => {
    const metadata = buildSessionMetadata(createSessionData("session-1"));

    expect(metadata.title).toBe(DEFAULT_SESSION_TITLE);
    expect(metadata.titleGenerationStatus).toBe("idle");
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
});