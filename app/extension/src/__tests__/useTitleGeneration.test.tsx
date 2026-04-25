/** @jest-environment jsdom */

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import { useTitleGeneration } from "../sidepanel/hooks/useTitleGeneration";
import type {
  ChatMessage,
  HuntlyModelInfo,
  SessionData,
} from "../sidepanel/types";
import { generateSessionTitleFromFirstMessage } from "../sidepanel/utils/titleGeneration";

jest.mock("../sidepanel/utils/titleGeneration", () => ({
  generateSessionTitleFromFirstMessage: jest.fn(),
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

type TitleGenerationAPI = ReturnType<typeof useTitleGeneration>;

const modelInfo: HuntlyModelInfo = {
  model: {} as HuntlyModelInfo["model"],
  modelId: "test-model",
  provider: "test-provider",
  displayName: "Test Model",
};

const generateTitleMock =
  generateSessionTitleFromFirstMessage as jest.MockedFunction<
    typeof generateSessionTitleFromFirstMessage
  >;

function createUserMessage(id: string, text: string): ChatMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }],
    status: "complete",
  };
}

function createRunningAssistantMessage(): ChatMessage {
  return {
    id: "assistant-1",
    role: "assistant",
    parts: [{ type: "text", text: "Streaming" }],
    status: "running",
  };
}

function createSession(messages: ChatMessage[]): SessionData {
  return {
    id: "session-1",
    title: "Untitled chat",
    titleGenerationStatus: "idle",
    currentModelId: "test-provider:test-model",
    thinkingEnabled: false,
    messages,
    createdAt: "2026-04-25T08:00:00.000Z",
    updatedAt: "2026-04-25T08:00:01.000Z",
    lastMessageAt: "2026-04-25T08:00:01.000Z",
    lastOpenedAt: "2026-04-25T08:00:01.000Z",
  };
}

function TitleGenerationHarness({
  getSessionData,
  onReady,
  syncSessionSnapshot,
}: {
  getSessionData: (sessionId: string) => SessionData | undefined;
  onReady: (api: TitleGenerationAPI) => void;
  syncSessionSnapshot: (session: SessionData, immediate: boolean) => void;
}) {
  const titleGeneration = useTitleGeneration({
    getCurrentModel: () => modelInfo,
    getTitleSystemPrompt: () => "Generate a title.",
    getSessionData,
    syncSessionSnapshot,
  });

  useEffect(() => {
    onReady(titleGeneration);
  }, [onReady, titleGeneration]);

  return null;
}

function renderTitleGeneration(initialSession: SessionData) {
  let session = initialSession;
  let api: TitleGenerationAPI | null = null;
  const container = document.createElement("div");
  const root = createRoot(container);
  const syncSessionSnapshot = jest.fn(
    (updatedSession: SessionData, _immediate: boolean) => {
      session = updatedSession;
    }
  );

  document.body.appendChild(container);

  act(() => {
    root.render(
      <TitleGenerationHarness
        getSessionData={(sessionId) =>
          session.id === sessionId ? session : undefined
        }
        onReady={(readyApi) => {
          api = readyApi;
        }}
        syncSessionSnapshot={syncSessionSnapshot}
      />
    );
  });

  if (!api) {
    throw new Error("Title generation API was not initialized");
  }

  return {
    api: api as TitleGenerationAPI,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    getSession: () => session,
    setSession: (nextSession: SessionData) => {
      session = nextSession;
    },
    syncSessionSnapshot,
  };
}

async function flushAsyncWork() {
  for (let index = 0; index < 6; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("useTitleGeneration", () => {
  beforeEach(() => {
    generateTitleMock.mockReset();
  });

  it("generates a title while the assistant response is still running", async () => {
    generateTitleMock.mockResolvedValue("Fast title");
    const runningSession = createSession([
      createUserMessage("user-1", "Explain fast title generation"),
      createRunningAssistantMessage(),
    ]);
    const { api, cleanup, getSession } = renderTitleGeneration(runningSession);

    act(() => {
      api.maybeGenerate(runningSession, runningSession.messages);
    });
    await flushAsyncWork();

    expect(generateTitleMock).toHaveBeenCalledTimes(1);
    expect(getSession().title).toBe("Fast title");
    expect(getSession().titleGenerationStatus).toBe("generated");

    cleanup();
  });

  it("does not repeat a failed title request for the same first message", async () => {
    generateTitleMock.mockResolvedValue(null);
    const runningSession = createSession([
      createUserMessage("user-1", ""),
      createRunningAssistantMessage(),
    ]);
    const { api, cleanup, getSession, setSession } =
      renderTitleGeneration(runningSession);

    act(() => {
      api.maybeGenerate(runningSession, runningSession.messages);
    });
    await flushAsyncWork();

    expect(generateTitleMock).toHaveBeenCalledTimes(2);
    expect(generateTitleMock.mock.calls[0][3]).toBe(false);
    expect(generateTitleMock.mock.calls[1][3]).toBe(true);
    expect(getSession().titleGenerationStatus).toBe("failed");

    const nextStreamingSnapshot = {
      ...getSession(),
      messages: [
        ...getSession().messages.slice(0, 1),
        {
          ...createRunningAssistantMessage(),
          parts: [{ type: "text" as const, text: "A later chunk" }],
        },
      ],
    };
    setSession(nextStreamingSnapshot);

    act(() => {
      api.maybeGenerate(nextStreamingSnapshot, nextStreamingSnapshot.messages);
    });
    await flushAsyncWork();

    expect(generateTitleMock).toHaveBeenCalledTimes(2);

    cleanup();
  });
});
