/** @jest-environment jsdom */

/// <reference types="node" />

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import { AssistantMessage } from "../sidepanel/components/AssistantMessage";
import type { ChatMessage } from "../sidepanel/types";

jest.mock("../sidepanel/components/AssistantStatusCard", () => ({
  AssistantStatusCard: () => null,
}));

jest.mock("../sidepanel/components/IconButton", () => ({
  IconButton: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => {
    const React = require("react");
    return React.createElement("button", { type: "button", onClick }, children);
  },
}));

jest.mock("../sidepanel/components/LinkCardsBlock", () => ({
  LinkCardsBlock: () => null,
}));

jest.mock("../sidepanel/components/MarkdownContent", () => ({
  MarkdownContent: ({ text }: { text: string }) => {
    const React = require("react");
    return React.createElement("div", null, text);
  },
}));

jest.mock("../sidepanel/components/MessageFooter", () => ({
  MessageFooter: ({ children }: { children: React.ReactNode }) => {
    const React = require("react");
    return React.createElement("div", null, children);
  },
}));

jest.mock("../sidepanel/components/ReasoningBlock", () => ({
  ReasoningBlock: ({ text }: { text: string }) => {
    const React = require("react");
    return React.createElement("div", null, text);
  },
}));

jest.mock("../sidepanel/components/ToolCallBlock", () => ({
  ToolCallBlock: () => null,
}));

jest.mock("../i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function renderAssistantMessage(
  props: Partial<React.ComponentProps<typeof AssistantMessage>> = {}
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const message: ChatMessage = {
    id: "assistant-1",
    role: "assistant",
    parts: [],
    status: "running",
  };

  act(() => {
    root.render(
      <AssistantMessage
        isLast={true}
        isRunning={true}
        message={message}
        thinkingMode={false}
        {...props}
      />
    );
  });

  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("AssistantMessage", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows a preparing response indicator before assistant text arrives", () => {
    const { container, cleanup } = renderAssistantMessage();
    const indicator = container.querySelector('[role="status"]');

    expect(indicator?.getAttribute("aria-label")).toBe("common.loading");
    expect(container.querySelectorAll(".claude-dot")).toHaveLength(3);
    expect(indicator?.className).not.toContain("rounded-full");
    expect(indicator?.className).not.toContain("border");

    cleanup();
  });

  it("keeps the preparing indicator visible for a leading step-start part", () => {
    const { container, cleanup } = renderAssistantMessage({
      message: {
        id: "assistant-2",
        role: "assistant",
        parts: [{ type: "step-start" }],
        status: "running",
      },
    });

    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelectorAll(".claude-dot")).toHaveLength(3);

    cleanup();
  });

  it("keeps the preparing indicator visible while reasoning is streaming", () => {
    const { container, cleanup } = renderAssistantMessage({
      message: {
        id: "assistant-3",
        role: "assistant",
        parts: [{ type: "reasoning", text: "Thinking", streaming: true }],
        status: "running",
      },
      thinkingMode: true,
    });

    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.textContent).toContain("Thinking");

    cleanup();
  });

  it("keeps the preparing indicator visible while a tool call is running", () => {
    const { container, cleanup } = renderAssistantMessage({
      message: {
        id: "assistant-4",
        role: "assistant",
        parts: [
          {
            type: "tool-call",
            toolCallId: "tool-1",
            toolName: "search_web",
            args: { query: "huntly" },
          },
        ],
        status: "running",
      },
    });

    expect(container.querySelector('[role="status"]')).not.toBeNull();

    cleanup();
  });

  it("shows the preparing indicator again after earlier text when a tool call starts", () => {
    const { container, cleanup } = renderAssistantMessage({
      message: {
        id: "assistant-5",
        role: "assistant",
        parts: [
          { type: "text", text: "先给你一个结论。" },
          {
            type: "tool-call",
            toolCallId: "tool-2",
            toolName: "search_web",
            args: { query: "huntly" },
          },
        ],
        status: "running",
      },
    });

    expect(container.querySelector('[role="status"]')).not.toBeNull();

    cleanup();
  });

  it("shows the preparing indicator again after earlier text when a new step starts", () => {
    const { container, cleanup } = renderAssistantMessage({
      message: {
        id: "assistant-6",
        role: "assistant",
        parts: [
          { type: "text", text: "先给你一个结论。" },
          { type: "step-start" },
        ],
        status: "running",
      },
    });

    expect(container.querySelector('[role="status"]')).not.toBeNull();

    cleanup();
  });

  it("hides the preparing indicator once visible text arrives", () => {
    const { container, cleanup } = renderAssistantMessage({
      message: {
        id: "assistant-7",
        role: "assistant",
        parts: [{ type: "text", text: "hello" }],
        status: "running",
      },
    });

    expect(container.querySelector('[role="status"]')).toBeNull();

    cleanup();
  });
});