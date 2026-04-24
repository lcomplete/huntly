import type { ChatMessage } from "../sidepanel/types";
import {
  buildMessagesForModel,
  compactConversation,
} from "../sidepanel/contextCompaction";
import { SessionChatPool } from "../sidepanel/chatPool";
import { prepareMessagesForRetry } from "../sidepanel/utils/retryMessages";
import type { HuntlyUIMessage } from "../sidepanel/useHuntlyChat";

jest.mock("ai", () => ({
  ToolLoopAgent: jest.fn(),
  convertToModelMessages: jest.fn(),
  isDataUIPart: (part: { type?: string }) =>
    Boolean(part.type?.startsWith("data-")),
  isReasoningUIPart: (part: { type?: string }) => part.type === "reasoning",
  isTextUIPart: (part: { type?: string }) => part.type === "text",
  isToolUIPart: (part: { type?: string }) =>
    Boolean(part.type === "dynamic-tool" || part.type?.startsWith("tool-")),
  stepCountIs: jest.fn(),
  streamText: jest.fn(),
  validateUIMessages: jest.fn(),
}));

jest.mock("@ai-sdk/react", () => {
  class FakeChat {
    messages: unknown[];
    status = "ready";
    error: Error | undefined;

    constructor({ messages = [] }: { messages?: unknown[] }) {
      this.messages = messages;
    }

    sendMessage = jest.fn(async () => undefined);
    regenerate = jest.fn(async () => undefined);
    resumeStream = jest.fn(async () => undefined);
    stop = jest.fn(async () => undefined);
    addToolOutput = jest.fn(async () => undefined);
    addToolApprovalResponse = jest.fn(async () => undefined);
    clearError = jest.fn(() => {
      this.error = undefined;
      this.status = "ready";
    });
  }

  return { Chat: FakeChat };
});

jest.mock("../sidepanel/agentTools", () => ({
  createAgentToolContext: jest.fn(async () => ({
    tools: {},
    close: jest.fn(async () => undefined),
  })),
  formatAgentToolTitle: jest.fn(() => "Tool"),
  getAgentToolMetadata: jest.fn(() => undefined),
  parseAgentToolTitle: jest.fn(() => null),
}));

jest.mock("../sidepanel/contextCompaction", () => {
  const actual = jest.requireActual("../sidepanel/contextCompaction");
  return {
    ...actual,
    compactConversation: jest.fn(),
  };
});

function userMessage(id: string, text: string): HuntlyUIMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }],
  };
}

function assistantMessage(
  id: string,
  parts: HuntlyUIMessage["parts"]
): HuntlyUIMessage {
  return {
    id,
    role: "assistant",
    parts,
  };
}

function statusPart(kind: "compacted" | "error") {
  return {
    type: "data-huntly-status",
    id: `status-${kind}`,
    data: {
      kind,
      errorCode: kind === "error" ? "context-overflow" : undefined,
      retryable: kind === "error" ? true : undefined,
      canCompact: kind === "error" ? true : undefined,
    },
  } as HuntlyUIMessage["parts"][number];
}

describe("sidepanel context compaction", () => {
  it("does not send historical reasoning or Huntly status data to the model", () => {
    const result = buildMessagesForModel([
      userMessage("user-1", "Question"),
      assistantMessage("assistant-1", [
        { type: "reasoning", text: "hidden chain", state: "done" } as any,
        statusPart("error"),
        { type: "text", text: "Visible answer", state: "done" } as any,
      ]),
    ]).messages;

    expect(result.map((message) => message.id)).toEqual([
      "user-1",
      "assistant-1",
    ]);
    expect(result[1].parts.map((part) => part.type)).toEqual(["text"]);
  });

  it("uses rolling summary plus only raw messages after the compacted boundary", () => {
    const result = buildMessagesForModel(
      [
        userMessage("user-1", "Old question"),
        assistantMessage("assistant-1", [
          { type: "text", text: "Old answer", state: "done" } as any,
        ]),
        userMessage("user-2", "New question"),
        assistantMessage("assistant-2", [
          { type: "text", text: "New answer", state: "done" } as any,
        ]),
      ],
      {
        text: "Earlier summary",
        summarizedThroughMessageId: "assistant-1",
        updatedAt: "2026-04-25T00:00:00.000Z",
        version: 1,
      }
    ).messages;

    expect(result[0].role).toBe("system");
    expect(result[0].parts[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Earlier summary"),
    });
    expect(result.slice(1).map((message) => message.id)).toEqual([
      "user-2",
      "assistant-2",
    ]);
  });
});

describe("sidepanel retry cleanup", () => {
  it("retries from the last user message instead of continuing persisted status cards", () => {
    const retryMessages = prepareMessagesForRetry([
      userMessage("user-1", "Try this"),
      assistantMessage("compact-status", [statusPart("compacted")]),
      assistantMessage("error-status", [statusPart("error")]),
    ]);

    expect(retryMessages.map((message) => message.id)).toEqual(["user-1"]);
  });

  it("drops a partial failed assistant response before retrying", () => {
    const retryMessages = prepareMessagesForRetry([
      userMessage("user-1", "First"),
      assistantMessage("assistant-1", [
        { type: "text", text: "Complete", state: "done" } as any,
      ]),
      userMessage("user-2", "Second"),
      assistantMessage("assistant-2", [
        { type: "text", text: "Partial", state: "done" } as any,
        statusPart("error"),
      ]),
    ]);

    expect(retryMessages.map((message) => message.id)).toEqual([
      "user-1",
      "assistant-1",
      "user-2",
    ]);
  });
});

describe("SessionChatPool manual compact", () => {
  beforeEach(() => {
    (compactConversation as jest.Mock).mockReset();
  });

  it("clears chat error state before manual compacting", async () => {
    const initialMessages: ChatMessage[] = Array.from(
      { length: 13 },
      (_, index) => ({
        id: `message-${index}`,
        role: index % 2 === 0 ? "user" : "assistant",
        parts: [{ type: "text", text: `message ${index}` }],
        status: "complete",
      })
    );
    const pool = new SessionChatPool(
      () => ({
        modelInfo: {
          modelId: "test-model",
          displayName: "Test Model",
          provider: "test",
          model: {} as any,
        },
        systemPrompt: "",
        thinkingEnabled: false,
      }),
      jest.fn()
    );
    const chat = pool.ensure("session-1", initialMessages);
    const clearErrorSpy = jest.spyOn(
      chat as unknown as { clearError: () => void },
      "clearError"
    );

    (compactConversation as jest.Mock).mockResolvedValue({
      rollingSummary: {
        text: "Updated summary",
        summarizedThroughMessageId: "message-4",
        updatedAt: "2026-04-25T00:00:00.000Z",
        version: 1,
      },
      compactedMessageCount: 5,
      compactedThroughMessageId: "message-4",
    });

    await pool.compact("session-1");

    expect(clearErrorSpy).toHaveBeenCalledTimes(1);
    expect(compactConversation).toHaveBeenCalledTimes(1);
  });
});
