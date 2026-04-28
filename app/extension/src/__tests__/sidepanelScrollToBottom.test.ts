/** @jest-environment jsdom */

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import {
  isScrollPinnedToBottom,
  shouldShowScrollToBottomButton,
} from "../sidepanel/utils/scrollToBottom";
import { useScrollPinToBottom } from "../sidepanel/hooks/useScrollPinToBottom";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

type ScrollHookSnapshot = {
  handleScroll: () => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
};

const TEST_THRESHOLD_PX = 160;

let latestHook: ScrollHookSnapshot | null = null;

function ScrollHarness({ messages }: { messages: string[] }) {
  const hook = useScrollPinToBottom({
    messages,
    thresholdPx: TEST_THRESHOLD_PX,
  });
  latestHook = hook;

  return React.createElement(
    "div",
    { ref: hook.scrollContainerRef, "data-testid": "scroll-container" },
    React.createElement(
      "div",
      null,
      React.createElement("div", { ref: hook.messagesEndRef })
    )
  );
}

function renderScrollHarness(messages: string[] = ["hello"]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(ScrollHarness, { messages }));
  });

  const scrollContainer = container.querySelector(
    '[data-testid="scroll-container"]'
  );
  if (!(scrollContainer instanceof HTMLDivElement)) {
    throw new Error("Scroll container not found");
  }

  return { container, root, scrollContainer };
}

function rerenderScrollHarness(root: Root, messages: string[]) {
  act(() => {
    root.render(React.createElement(ScrollHarness, { messages }));
  });
}

function setScrollMetrics(
  element: HTMLDivElement,
  metrics: { clientHeight: number; scrollHeight: number; scrollTop: number }
) {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: metrics.clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: metrics.scrollHeight,
  });
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    value: metrics.scrollTop,
    writable: true,
  });
}

function unmount(root: Root, container: HTMLDivElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

beforeEach(() => {
  latestHook = null;
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("sidepanel scroll-to-bottom helpers", () => {
  it("treats positions within the threshold as pinned to the bottom", () => {
    expect(isScrollPinnedToBottom(12, 96)).toBe(true);
    expect(isScrollPinnedToBottom(95, 96)).toBe(true);
    expect(isScrollPinnedToBottom(96, 96)).toBe(true);
    expect(isScrollPinnedToBottom(97, 96)).toBe(false);
  });

  it("shows the down-arrow button only when there are messages and the view is not pinned", () => {
    expect(shouldShowScrollToBottomButton(0, false)).toBe(false);
    expect(shouldShowScrollToBottomButton(3, true)).toBe(false);
    expect(shouldShowScrollToBottomButton(3, false)).toBe(true);
  });
});

describe("useScrollPinToBottom", () => {
  it("keeps output pinned to the bottom while already at the bottom", () => {
    const { container, root, scrollContainer } = renderScrollHarness();
    setScrollMetrics(scrollContainer, {
      clientHeight: 300,
      scrollHeight: 720,
      scrollTop: 420,
    });

    Object.defineProperty(scrollContainer, "scrollHeight", {
      configurable: true,
      value: 900,
    });
    rerenderScrollHarness(root, ["hello", "streaming"]);

    expect(scrollContainer.scrollTop).toBe(600);
    unmount(root, container);
  });

  it("stops auto-scrolling after the user scrolls away", () => {
    const { container, root, scrollContainer } = renderScrollHarness();
    setScrollMetrics(scrollContainer, {
      clientHeight: 300,
      scrollHeight: 720,
      scrollTop: 120,
    });

    act(() => {
      latestHook?.handleScroll();
    });

    Object.defineProperty(scrollContainer, "scrollHeight", {
      configurable: true,
      value: 900,
    });
    rerenderScrollHarness(root, ["hello", "streaming"]);

    expect(scrollContainer.scrollTop).toBe(120);
    unmount(root, container);
  });

  it("resumes auto-scrolling when the user returns near the bottom", () => {
    const { container, root, scrollContainer } = renderScrollHarness();
    setScrollMetrics(scrollContainer, {
      clientHeight: 300,
      scrollHeight: 720,
      scrollTop: 120,
    });

    act(() => {
      latestHook?.handleScroll();
    });

    setScrollMetrics(scrollContainer, {
      clientHeight: 300,
      scrollHeight: 900,
      scrollTop: 460,
    });

    act(() => {
      latestHook?.handleScroll();
    });

    Object.defineProperty(scrollContainer, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    rerenderScrollHarness(root, ["hello", "streaming"]);

    expect(scrollContainer.scrollTop).toBe(700);
    unmount(root, container);
  });
});
