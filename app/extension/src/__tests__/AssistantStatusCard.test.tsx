/** @jest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import { AssistantStatusCard } from "../sidepanel/components/AssistantStatusCard";
import type { ChatPart } from "../sidepanel/types";

jest.mock("../sidepanel/components/MarkdownContent", () => ({
  MarkdownContent: ({ text }: { text: string }) => {
    const React = require("react");
    return React.createElement("div", null, text);
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

function renderStatusCard(
  props: Partial<React.ComponentProps<typeof AssistantStatusCard>> = {}
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const part: ChatPart = {
    type: "status",
    statusKind: "error",
    errorCode: "context-overflow",
    retryable: true,
    canCompact: true,
  };

  act(() => {
    root.render(
      <AssistantStatusCard
        actionable={true}
        part={part}
        onCompactContext={jest.fn()}
        onRetryLastRun={jest.fn()}
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

describe("AssistantStatusCard", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("disables actions and marks the active retry button busy", () => {
    const { container, cleanup } = renderStatusCard({ busyAction: "retry" });
    const buttons = Array.from(container.querySelectorAll("button"));

    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(buttons[0].getAttribute("aria-busy")).toBe("true");
    expect(buttons[0].className).toContain("focus-visible:ring-2");

    cleanup();
  });

  it("disables actions and marks the active compact button busy", () => {
    const { container, cleanup } = renderStatusCard({ busyAction: "compact" });
    const buttons = Array.from(container.querySelectorAll("button"));

    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(buttons[1].getAttribute("aria-busy")).toBe("true");

    cleanup();
  });
});
