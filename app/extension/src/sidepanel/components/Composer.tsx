import { useMemo, useRef, useState, type FC } from "react";
import {
  ArrowUp,
  History,
  Paperclip,
  Square,
  SquarePen,
  X,
} from "lucide-react";
import type { ChatPart, HuntlyModelInfo, SlashPrompt } from "../types";
import type { TabContext } from "../utils/tabContext";
import { formatFileSize } from "../utils/format";
import { getTriggeredPromptPrefix } from "../utils/messageParts";
import { ComposerActionMenu } from "./ComposerActionMenu";
import { ComposerContextBar } from "./ComposerContextBar";
import { HighlightedPromptText } from "./HighlightedPromptText";
import { IconButton } from "./IconButton";
import { ModelDropdown } from "./ModelDropdown";
import { SlashPromptMenu } from "./SlashPromptMenu";

interface ComposerProps {
  tabContext: TabContext | null;
  contextAttached: boolean;
  contextError: string | null;
  contextLoading: boolean;
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
  onAttachmentFiles: (files: FileList) => void;
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const submitDisabled =
    (!inputText.trim() && attachments.length === 0) || isRunning;
  const triggeredPromptPrefix = useMemo(
    () => getTriggeredPromptPrefix(inputText, slashPrompts),
    [inputText, slashPrompts]
  );
  const slashMenuVisible = inputText.startsWith("/");

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <div className="mb-2 flex min-h-8 items-center justify-between gap-2 px-1">
        {(tabContext || contextError) && (
          <ComposerContextBar
            contextAttached={contextAttached}
            contextError={contextError}
            contextLoading={contextLoading}
            onAttachContext={onAttachContext}
            onDetachContext={onDetachContext}
            tabContext={tabContext}
          />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <IconButton
            active={historyOpen}
            label="Chat history"
            onClick={onToggleHistory}
          >
            <History className="size-4" />
          </IconButton>
          <IconButton label="New chat" onClick={onNewChat}>
            <SquarePen className="size-4" />
          </IconButton>
        </div>
      </div>
      <form className="relative" onSubmit={onSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(event) => {
            if (event.target.files?.length) {
              onAttachmentFiles(event.target.files);
            }
            event.currentTarget.value = "";
          }}
        />
        <SlashPromptMenu
          visible={slashMenuVisible}
          prompts={filteredPrompts}
          onSelect={onSlashPromptSelect}
          selectedIndex={slashPromptIndex}
        />

        <div className="rounded-2xl border border-[#d8cfbf] bg-[#fffaf4] shadow-[0_16px_55px_rgba(64,48,31,0.10)]">
          {attachments.length > 0 && (
            <div className="flex flex-wrap items-start gap-2 px-3 pt-3">
              {attachments.map((attachment) => {
                const label = attachment.filename || "Attachment";
                const size = formatFileSize(attachment.size);
                const isImage = attachment.mediaType?.startsWith("image/");
                return isImage && attachment.dataUrl ? (
                  <div
                    key={attachment.id || label}
                    className="relative h-24 w-24 shrink-0 rounded-lg border border-[#ded4c4] bg-[#f4efe6]"
                  >
                    <button
                      type="button"
                      className="h-full w-full overflow-hidden rounded-lg"
                      onClick={() => setPreviewUrl(attachment.dataUrl!)}
                      aria-label={`Preview ${label}`}
                    >
                      <img
                        src={attachment.dataUrl}
                        alt={label}
                        className="h-full w-full object-cover"
                      />
                    </button>
                    {attachment.id && (
                      <button
                        type="button"
                        aria-label={`Remove ${label}`}
                        title={`Remove ${label}`}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#2f261f]/60 text-white transition-colors hover:bg-[#2f261f]/90"
                        onClick={() => onAttachmentRemove(attachment.id!)}
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    key={attachment.id || label}
                    className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-[#ded4c4] bg-[#f4efe6] px-2 py-1 text-xs text-[#5f5347]"
                  >
                    <Paperclip className="size-4 shrink-0 text-[#6f6254]" />
                    <span className="max-w-[180px] truncate font-medium">
                      {label}
                    </span>
                    {size && (
                      <span className="shrink-0 text-[#6f6254]">{size}</span>
                    )}
                    {attachment.id && (
                      <button
                        type="button"
                        aria-label={`Remove ${label}`}
                        title={`Remove ${label}`}
                        className="ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#6f6254] transition-colors hover:bg-[#e9dcc7] hover:text-[#2f261f]"
                        onClick={() => onAttachmentRemove(attachment.id!)}
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="relative min-h-[84px]">
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
              value={inputText}
              rows={1}
              className={[
                "relative z-10 min-h-[84px] w-full resize-none bg-transparent px-4 pt-4 text-[15px] leading-6 outline-none placeholder:text-[#6f6254]",
                triggeredPromptPrefix
                  ? "text-transparent caret-[#2f261f]"
                  : "text-[#2f261f]",
              ].join(" ")}
              placeholder="How can I help you today?"
              onChange={onInputChange}
              onKeyDown={onKeyDown}
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
                aria-label="Stop"
                title="Stop"
                onClick={onCancel}
              >
                <Square className="size-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitDisabled}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2f261f] text-[#fffaf4] transition-colors hover:bg-[#46382d] disabled:cursor-not-allowed disabled:bg-[#d7cbbb] disabled:text-[#5f5347]"
                aria-label="Send"
                title="Send"
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>
        </div>
      </form>

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f261f]/60"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            type="button"
            aria-label="Close preview"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#2f261f]/60 text-white transition-colors hover:bg-[#2f261f]/90"
            onClick={() => setPreviewUrl(null)}
          >
            <X className="size-5" />
          </button>
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
