/** @jest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { HistoryDrawer } from "../sidepanel/components/HistoryDrawer";
import type { SessionMetadata } from "../sidepanel/types";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../sidepanel/components/SmartMoment", () => ({
  SmartMoment: () => <span>just now</span>,
}));

function createSession(
  id: string,
  overrides: Partial<SessionMetadata> = {}
): SessionMetadata {
  return {
    id,
    title: "Session one",
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

type FrameCallback = Parameters<typeof window.requestAnimationFrame>[0];

let animationFrames: Array<FrameCallback | null> = [];
let originalRequestAnimationFrame: typeof window.requestAnimationFrame;
let originalCancelAnimationFrame: typeof window.cancelAnimationFrame;
let originalResizeObserver: typeof globalThis.ResizeObserver;
let originalGetClientRects: typeof HTMLElement.prototype.getClientRects;

function flushAnimationFrames() {
  act(() => {
    while (animationFrames.length > 0) {
      const pending = animationFrames;
      animationFrames = [];

      pending.forEach((callback) => {
        callback?.(performance.now());
      });
    }
  });
}

function renderHistoryDrawer(
  overrides: Partial<React.ComponentProps<typeof HistoryDrawer>> = {}
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const props: React.ComponentProps<typeof HistoryDrawer> = {
    open: true,
    sessions: [createSession("session-1")],
    currentSessionId: null,
    onClose: jest.fn(),
    onSelect: jest.fn(),
    onDelete: jest.fn(),
    onRename: jest.fn(),
    onTogglePinned: jest.fn(),
    onToggleArchived: jest.fn(),
    showArchived: false,
    onToggleShowArchived: jest.fn(),
    ...overrides,
  };

  act(() => {
    root.render(<HistoryDrawer {...props} />);
  });

  flushAnimationFrames();

  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("HistoryDrawer", () => {
  beforeEach(() => {
    animationFrames = [];
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
    originalResizeObserver = globalThis.ResizeObserver;
    originalGetClientRects = HTMLElement.prototype.getClientRects;

    window.requestAnimationFrame = ((callback: FrameCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    }) as typeof window.requestAnimationFrame;

    window.cancelAnimationFrame = ((id: number) => {
      if (id > 0 && id <= animationFrames.length) {
        animationFrames[id - 1] = null;
      }
    }) as typeof window.cancelAnimationFrame;

    class ResizeObserverMock {
      observe() {}

      disconnect() {}

      unobserve() {}
    }

    globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

    HTMLElement.prototype.getClientRects = function getClientRects() {
      return [{ width: 1, height: 1 }] as unknown as DOMRectList;
    };
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    globalThis.ResizeObserver = originalResizeObserver;
    HTMLElement.prototype.getClientRects = originalGetClientRects;
    document.body.innerHTML = "";
  });

  it("focuses and selects the full title when rename mode opens", () => {
    const { container, cleanup } = renderHistoryDrawer();

    const menuButton = container.querySelector(
      'button[aria-label="More actions for Session one"]'
    );
    if (!(menuButton instanceof HTMLButtonElement)) {
      throw new Error("Session menu button not found");
    }

    act(() => {
      menuButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    flushAnimationFrames();

    const renameButton = Array.from(
      container.querySelectorAll('button[role="menuitem"]')
    ).find(
      (element) =>
        element instanceof HTMLButtonElement &&
        element.textContent?.includes("Rename")
    );

    if (!(renameButton instanceof HTMLButtonElement)) {
      throw new Error("Rename action not found");
    }

    act(() => {
      renameButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    flushAnimationFrames();

    const renameInput = container.querySelector('input[aria-label="Rename chat"]');
    if (!(renameInput instanceof HTMLInputElement)) {
      throw new Error("Rename input not found");
    }

    expect(document.activeElement).toBe(renameInput);
    expect(renameInput.selectionStart).toBe(0);
    expect(renameInput.selectionEnd).toBe(renameInput.value.length);

    cleanup();
  });
});