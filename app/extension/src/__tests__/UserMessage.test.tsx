/** @jest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import { UserMessage } from "../sidepanel/components/UserMessage";
import type { ChatMessage } from "../sidepanel/types";

jest.mock("../sidepanel/components/HighlightedPromptText", () => ({
  HighlightedPromptText: ({ text }: { text: string }) => {
    const React = require("react");
    return React.createElement("span", null, text);
  },
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

function createUserMessage(): ChatMessage {
  return {
    id: "user-1",
    role: "user",
    parts: [{ type: "text", text: "Hello Huntly" }],
    status: "complete",
  };
}

function renderUserMessage(
  props: Partial<React.ComponentProps<typeof UserMessage>> = {}
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <UserMessage isRunning={false} message={createUserMessage()} {...props} />
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

describe("UserMessage", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows retry between copy and edit for user messages", () => {
    const onEdit = jest.fn();
    const onRetry = jest.fn();
    const { container, cleanup } = renderUserMessage({ onEdit, onRetry });
    const buttons = Array.from(container.querySelectorAll("button"));

    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "common.copy",
      "sidepanel.retryResponse",
      "sidepanel.editMessage",
    ]);

    act(() => {
      buttons[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onRetry).toHaveBeenCalledWith("user-1");

    cleanup();
  });

  it("uses the edit enablement logic for retry", () => {
    const { container, cleanup } = renderUserMessage({
      isRunning: true,
      onEdit: jest.fn(),
      onRetry: jest.fn(),
    });
    const retryButton = container.querySelector(
      'button[aria-label="sidepanel.retryResponse"]'
    ) as HTMLButtonElement | null;
    const editButton = container.querySelector(
      'button[aria-label="sidepanel.editMessage"]'
    ) as HTMLButtonElement | null;

    expect(retryButton?.disabled).toBe(true);
    expect(editButton?.disabled).toBe(true);

    cleanup();
  });
});
