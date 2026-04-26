import { useMemo, useRef, type FC } from "react";
import { ArrowUp, History, Square, SquarePen } from "lucide-react";
import type { ChatPart, HuntlyModelInfo, SlashPrompt } from "../types";
import type { TabContext } from "../utils/tabContext";
import { isImageFile } from "../utils/dropPayload";
import { getTriggeredPromptPrefix } from "../utils/messageParts";
import { AttachmentPreviewList } from "./AttachmentPreviewList";
import { ComposerActionMenu } from "./ComposerActionMenu";
import { ComposerContextBar } from "./ComposerContextBar";
import { HighlightedPromptText } from "./HighlightedPromptText";
import { IconButton } from "./IconButton";
import { ModelDropdown } from "./ModelDropdown";
import { SlashPromptMenu } from "./SlashPromptMenu";
import { useI18n } from "../../i18n";

function getPastedImageFiles(
  clipboardData: DataTransfer | null
): File[] {
  if (!clipboardData) {
    return [];
  }

  const filesFromItems = Array.from(clipboardData.items || [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file && isImageFile(file)));

  if (filesFromItems.length > 0) {
    return filesFromItems;
  }

  return Array.from(clipboardData.files || []).filter(isImageFile);
}

interface ComposerProps {
  tabContext: TabContext | null;
  contextAttached: boolean;
  contextError: string | null;
  contextLoading: boolean;
  attachmentProcessingLabel: string | null;
  inputText: string;
  attachments: ChatPart[];
  filteredPrompts: SlashPrompt[];
  slashPromptIndex: number;
  slashPrompts: SlashPrompt[];
  isRunning: boolean;
  historyOpen: boolean;
  thinkingMode: boolean;
  models: HuntlyModelInfo[];
  currentModelId: string | null;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  onAttachContext: () => void;
  onDetachContext: () => void;
  onSlashPromptSelect: (prompt: SlashPrompt) => void;
  onAttachmentFiles: (files: FileList | File[]) => void;
  onAttachmentRemove: (id: string) => void;
  onModelSelect: (model: HuntlyModelInfo) => void;
  onOpenSettings: () => void;
  onToggleHistory: () => void;
  onNewChat: () => void;
  onThinkingModeToggle: () => void;
}

export const Composer: FC<ComposerProps> = ({
  tabContext,
  contextAttached,
  contextError,
  contextLoading,
  attachmentProcessingLabel,
  inputText,
  attachments,
  filteredPrompts,
  slashPromptIndex,
  slashPrompts,
  isRunning,
  historyOpen,
  thinkingMode,
  models,
  currentModelId,
  inputRef,
  onInputChange,
  onKeyDown,
  onSubmit,
  onCancel,
  onAttachContext,
  onDetachContext,
  onSlashPromptSelect,
  onAttachmentFiles,
  onAttachmentRemove,
  onModelSelect,
  onOpenSettings,
  onToggleHistory,
  onNewChat,
  onThinkingModeToggle,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const attachmentProcessing = Boolean(attachmentProcessingLabel);
  const submitDisabled =
    (!inputText.trim() && attachments.length === 0) ||
    isRunning ||
    attachmentProcessing;
  const triggeredPromptPrefix = useMemo(
    () => getTriggeredPromptPrefix(inputText, slashPrompts),
    [inputText, slashPrompts]
  );
  const slashMenuVisible = inputText.startsWith("/");
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedImageFiles = getPastedImageFiles(event.clipboardData);
    if (pastedImageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    onAttachmentFiles(pastedImageFiles);
  };

  const handleComposerMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (
      target.closest(
        "button, input, textarea, select, a, label, [role='button'], [role='listbox'], [role='option'], [contenteditable='true']"
      )
    ) {
      return;
    }

    const textarea = inputRef.current;
    if (!textarea) {
      return;
    }

    event.preventDefault();
    if (document.activeElement !== textarea) {
      textarea.focus();
    }
  };

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <div className="mb-2 flex flex-col gap-2 px-1">
        <div className="flex min-h-8 items-center justify-between gap-2">
          {tabContext || contextError ? (
            <ComposerContextBar
              contextAttached={contextAttached}
              contextError={contextError}
              contextLoading={contextLoading}
              onAttachContext={onAttachContext}
              onDetachContext={onDetachContext}
              tabContext={tabContext}
            />
          ) : (
            <span className="min-w-0" />
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <IconButton
              active={historyOpen}
              label={t("common.history")}
              onClick={onToggleHistory}
            >
              <History className="size-4" />
            </IconButton>
            <IconButton label={t("common.newChat")} onClick={onNewChat}>
              <SquarePen className="size-4" />
            </IconButton>
          </div>
        </div>
      </div>
      <form className="relative" onSubmit={onSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          multiple
          onChange={(event) => {
            if (event.target.files?.length) {
              onAttachmentFiles(event.target.files);
            }
            event.currentTarget.value = "";
          }}
        />
        <div
          className="cursor-text rounded-2xl border border-[#d8cfbf] bg-[#fffaf4] shadow-[0_16px_55px_rgba(64,48,31,0.10)]"
          onMouseDown={handleComposerMouseDown}
        >
          {(attachments.length > 0 || attachmentProcessing) && (
            <div className="px-4 pt-4">
              <AttachmentPreviewList
                attachments={attachments}
                processingLabel={attachmentProcessingLabel}
                onRemove={onAttachmentRemove}
              />
            </div>
          )}
          <div className="relative min-h-[84px]">
            <SlashPromptMenu
              visible={slashMenuVisible}
              prompts={filteredPrompts}
              onSelect={onSlashPromptSelect}
              selectedIndex={slashPromptIndex}
            />
            {triggeredPromptPrefix && inputText && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-4 pt-4 text-[15px] leading-6 text-[#2f261f]"
              >
                <HighlightedPromptText
                  promptClassName="text-[#9a4f2c]"
                  promptPrefix={triggeredPromptPrefix}
                  text={inputText}
                />
              </div>
            )}
            <textarea
              ref={inputRef}
              aria-busy={attachmentProcessing || undefined}
              value={inputText}
              rows={1}
              className={[
                "relative z-10 min-h-[84px] w-full resize-none bg-transparent px-4 pt-4 text-[15px] leading-6 outline-none placeholder:text-[#6f6254]",
                triggeredPromptPrefix
                  ? "text-transparent caret-[#2f261f]"
                  : "text-[#2f261f]",
              ].join(" ")}
              placeholder={t("sidepanel.composer.placeholder")}
              onChange={onInputChange}
              onKeyDown={onKeyDown}
              onPaste={handlePaste}
            />
          </div>

          <div className="flex min-h-12 items-center justify-between gap-2 px-2 pb-2">
            <div className="flex min-w-0 items-center gap-1">
              <ComposerActionMenu
                prompts={slashPrompts}
                onPromptSelect={onSlashPromptSelect}
                onUploadClick={() => fileInputRef.current?.click()}
              />
              <ModelDropdown
                currentModelId={currentModelId}
                models={models}
                onOpenSettings={onOpenSettings}
                onSelect={onModelSelect}
                onThinkingModeToggle={onThinkingModeToggle}
                thinkingMode={thinkingMode}
              />
            </div>

            {isRunning ? (
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a34020] text-[#fffaf4] transition-colors hover:bg-[#8c351a]"
                aria-label={t("common.stop")}
                title={t("common.stop")}
                onClick={onCancel}
              >
                <Square className="size-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitDisabled}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2f261f] text-[#fffaf4] transition-colors hover:bg-[#46382d] disabled:cursor-not-allowed disabled:bg-[#d7cbbb] disabled:text-[#5f5347]"
                aria-label={t("common.send")}
                title={attachmentProcessing ? t("sidepanel.composer.processingAttachment") : t("common.send")}
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
