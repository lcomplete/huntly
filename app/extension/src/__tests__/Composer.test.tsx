/** @jest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import type { HuntlyModelInfo, SlashPrompt } from "../sidepanel/types";
import { Composer } from "../sidepanel/components/Composer";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../sidepanel/components/AttachmentPreviewList", () => ({
  AttachmentPreviewList: () => null,
}));

jest.mock("../i18n", () => ({
  useI18n: () => ({
    language: "en",
    setLanguage: jest.fn(),
    t: (key: string) => key,
  }),
}));

jest.mock("../sidepanel/components/ComposerActionMenu", () => ({
  ComposerActionMenu: () => null,
}));

jest.mock("../sidepanel/components/ComposerContextBar", () => ({
  ComposerContextBar: () => null,
}));

jest.mock("../sidepanel/components/HighlightedPromptText", () => ({
  HighlightedPromptText: ({ text }: { text: string }) => <>{text}</>,
}));

jest.mock("../sidepanel/components/IconButton", () => ({
  IconButton: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

jest.mock("../sidepanel/components/ModelDropdown", () => ({
  ModelDropdown: () => null,
}));

jest.mock("../sidepanel/components/SlashPromptMenu", () => ({
  SlashPromptMenu: () => null,
}));

const inputRef = { current: null as HTMLTextAreaElement | null };
const noop = () => {};
const slashPrompts: SlashPrompt[] = [];
const models: HuntlyModelInfo[] = [];

function renderComposer(
  overrides: Partial<React.ComponentProps<typeof Composer>> = {}
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const props: React.ComponentProps<typeof Composer> = {
    tabContext: null,
    contextAttached: false,
    contextError: null,
    contextLoading: false,
    attachmentProcessingLabel: null,
    inputText: "",
    attachments: [],
    filteredPrompts: slashPrompts,
    slashPromptIndex: 0,
    slashPrompts,
    isRunning: false,
    historyOpen: false,
    thinkingMode: false,
    models,
    currentModelId: null,
    inputRef,
    onInputChange: noop,
    onKeyDown: noop,
    onSubmit: (event) => event.preventDefault(),
    onCancel: noop,
    onAttachContext: noop,
    onDetachContext: noop,
    onSlashPromptSelect: noop,
    onAttachmentFiles: noop,
    onAttachmentRemove: noop,
    onModelSelect: noop,
    onOpenSettings: noop,
    onToggleHistory: noop,
    onNewChat: noop,
    onThinkingModeToggle: noop,
    ...overrides,
  };

  act(() => {
    root.render(<Composer {...props} />);
  });

  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error("Composer textarea not found");
  }

  return {
    textarea,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function createClipboardEvent(clipboardData: Partial<DataTransfer>) {
  const event = new Event("paste", {
    bubbles: true,
    cancelable: true,
  });

  Object.defineProperty(event, "clipboardData", {
    configurable: true,
    value: clipboardData,
  });

  return event;
}

function createFileList(files: File[]): FileList {
  return files as unknown as FileList;
}

function createDataTransferItemList(
  items: Array<Partial<DataTransferItem>>
): DataTransferItemList {
  return items as unknown as DataTransferItemList;
}

describe("Composer", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    inputRef.current = null;
  });

  it("attaches pasted images through the attachment handler", () => {
    const onAttachmentFiles = jest.fn();
    const pastedImage = new File(["image-bytes"], "clipboard.png", {
      type: "image/png",
    });
    const { textarea, cleanup } = renderComposer({ onAttachmentFiles });

    const pasteEvent = createClipboardEvent({
      items: createDataTransferItemList([
        {
          kind: "file",
          type: pastedImage.type,
          getAsFile: () => pastedImage,
        } as DataTransferItem,
      ]),
      files: createFileList([pastedImage]),
    });

    const dispatchResult = textarea.dispatchEvent(pasteEvent);

    expect(onAttachmentFiles).toHaveBeenCalledWith([pastedImage]);
    expect(dispatchResult).toBe(false);

    cleanup();
  });

  it("keeps normal text paste behavior unchanged", () => {
    const onAttachmentFiles = jest.fn();
    const { textarea, cleanup } = renderComposer({ onAttachmentFiles });

    const pasteEvent = createClipboardEvent({
      items: createDataTransferItemList([
        {
          kind: "string",
          type: "text/plain",
          getAsFile: () => null,
        } as DataTransferItem,
      ]),
      files: createFileList([]),
    });

    const dispatchResult = textarea.dispatchEvent(pasteEvent);

    expect(onAttachmentFiles).not.toHaveBeenCalled();
    expect(dispatchResult).toBe(true);

    cleanup();
  });
});
