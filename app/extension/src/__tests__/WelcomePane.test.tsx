/** @jest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import { WelcomePane } from "../sidepanel/components/Placeholders";
import type { SlashPrompt } from "../sidepanel/types";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../i18n", () => ({
  useI18n: () => ({
    language: "en",
    setLanguage: jest.fn(),
    t: (key: string) => {
      const labels: Record<string, string> = {
        "sidepanel.welcome.action.imageDescribe.prompt": "Describe image",
        "sidepanel.welcome.action.imageOcr.prompt": "Read text in image",
        "sidepanel.welcome.action.imageTranslate.prompt": "Translate image",
        "sidepanel.welcome.action.pageExplain.prompt": "Explain page",
        "sidepanel.welcome.action.pageSummary.prompt": "Summarize page",
        "sidepanel.welcome.action.selectionExplain.prompt": "Explain selection",
        "sidepanel.welcome.action.selectionTranslate.prompt":
          "Translate selection",
        "sidepanel.welcome.empty.image": "Attach an image to continue.",
        "sidepanel.welcome.empty.page": "Open a page to continue.",
        "sidepanel.welcome.empty.prompts": "No prompts yet.",
        "sidepanel.welcome.group.image": "Images",
        "sidepanel.welcome.group.page": "Page",
        "sidepanel.welcome.group.shortcuts": "Prompts",
        "sidepanel.welcome.title": "Huntly",
      };

      return labels[key] || key;
    },
  }),
}));

function renderWelcomePane(
  overrides: Partial<React.ComponentProps<typeof WelcomePane>> = {}
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const props: React.ComponentProps<typeof WelcomePane> = {
    slashPrompts: [
      {
        id: "prompt-1",
        name: "Summarize",
        trigger: "summarize",
        promptContent: "Summarize this.",
        source: "local",
      } satisfies SlashPrompt,
    ],
    tabContext: {
      url: "https://example.com/article",
      title: "Example article",
    },
    huntlyMcpEnabled: false,
    onQuickActionSend: jest.fn(),
    onQuickActionFillComposer: jest.fn(),
    disabled: false,
    ...overrides,
  };

  act(() => {
    root.render(<WelcomePane {...props} />);
  });

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

describe("WelcomePane", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not select a welcome group by default", () => {
    const { container, cleanup } = renderWelcomePane();

    const promptButton = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent?.includes("Prompts")
    );
    if (!(promptButton instanceof HTMLButtonElement)) {
      throw new Error("Prompts group button not found");
    }

    expect(promptButton.getAttribute("aria-pressed")).toBe("false");
    expect(container.textContent).not.toContain("Summarize page");
    expect(container.textContent).not.toContain("/summarize");

    cleanup();
  });
});
