/** @jest-environment jsdom */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { useEffect } from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { useSessionPersistence } from "../sidepanel/hooks/useSessionPersistence";
import { saveSession } from "../sidepanel/sessionStorage";
import type { SessionData } from "../sidepanel/types";

jest.mock("../sidepanel/sessionStorage", () => ({
  saveSession: jest.fn(() => Promise.resolve()),
  deleteSession: jest.fn(() => Promise.resolve()),
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

type PersistenceAPI = ReturnType<typeof useSessionPersistence>;
type SaveSessionMock = {
  mock: {
    calls: Array<[SessionData]>;
  };
};

function getSaveSessionCalls(): Array<[SessionData]> {
  return (saveSession as unknown as SaveSessionMock).mock.calls;
}

function createSession(id: string, text: string): SessionData {
  return {
    id,
    title: "Untitled chat",
    titleGenerationStatus: "idle",
    currentModelId: null,
    thinkingEnabled: false,
    messages: [
      {
        id: `${id}-message`,
        role: "assistant",
        parts: [{ type: "text", text }],
        status: "running",
      },
    ],
    createdAt: "2026-04-25T08:00:00.000Z",
    updatedAt: "2026-04-25T08:00:01.000Z",
    lastMessageAt: "2026-04-25T08:00:01.000Z",
    lastOpenedAt: "2026-04-25T08:00:01.000Z",
  };
}

function PersistenceHarness({
  onReady,
}: {
  onReady: (api: PersistenceAPI) => void;
}) {
  const persistence = useSessionPersistence();

  useEffect(() => {
    onReady(persistence);
  }, [onReady, persistence]);

  return null;
}

function renderPersistence() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let persistenceApi: PersistenceAPI | null = null;

  act(() => {
    root.render(
      <PersistenceHarness
        onReady={(api) => {
          persistenceApi = api;
        }}
      />
    );
  });

  if (!persistenceApi) {
    throw new Error("Persistence API was not initialized");
  }

  return {
    api: persistenceApi as PersistenceAPI,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useSessionPersistence", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("persists debounced snapshots for multiple sessions", async () => {
    const { api, cleanup } = renderPersistence();

    act(() => {
      api.persist(createSession("session-1", "First stream chunk"), false);
      api.persist(createSession("session-2", "Second stream chunk"), false);
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await act(async () => {
      await api.flush();
    });

    expect(getSaveSessionCalls().map(([session]) => session.id)).toEqual([
      "session-1",
      "session-2",
    ]);

    cleanup();
  });

  it("keeps other pending sessions when one session is saved immediately", async () => {
    const { api, cleanup } = renderPersistence();

    act(() => {
      api.persist(createSession("session-1", "Draft chunk"), false);
      api.persist(createSession("session-2", "Background chunk"), false);
      api.persist(createSession("session-1", "Final chunk"), true);
    });

    await act(async () => {
      await api.flush();
    });

    const savedSessions = getSaveSessionCalls().map(([session]) => session);

    expect(savedSessions.map((session) => session.id)).toEqual([
      "session-1",
      "session-2",
    ]);
    expect(savedSessions[0].messages[0].parts[0].text).toBe("Final chunk");
    expect(savedSessions[1].messages[0].parts[0].text).toBe("Background chunk");

    cleanup();
  });
});
