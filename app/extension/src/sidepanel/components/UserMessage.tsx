import React, { useEffect, useMemo, useRef, useState, type FC } from "react";
import { Check, Copy, Paperclip, PencilLine, X } from "lucide-react";
import { MessageFooter } from "./MessageFooter";
import type { ChatMessage } from "../types";
import { useAutosizeTextArea } from "../utils/dom";
import { formatFileSize } from "../utils/format";
import { getDisplayMessage } from "../utils/messageParts";
import { HighlightedPromptText } from "./HighlightedPromptText";
import { IconButton } from "./IconButton";
import { PageContextBadge } from "./PageContextBadge";
import { useI18n } from "../../i18n";

interface UserMessageProps {
  editingText?: string;
  isRunning: boolean;
  isEditing?: boolean;
  message: ChatMessage;
  onCancelEdit?: () => void;
  onEdit?: (messageId: string) => void;
  onEditingTextChange?: (value: string) => void;
  onSaveEdit?: (messageId: string) => void;
}

const UserMessageImpl: FC<UserMessageProps> = ({
  editingText = "",
  isRunning,
  isEditing = false,
  message,
  onCancelEdit,
  onEdit,
  onEditingTextChange,
  onSaveEdit,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { t } = useI18n();
  const [copyFeedbackVisible, setCopyFeedbackVisible] = useState(false);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const display = useMemo(() => getDisplayMessage(message.parts), [
    message.parts,
  ]);
  const text = display.text;
  const pageContexts = message.parts.filter(
    (part) => part.type === "page-context"
  );
  const attachments = message.parts.filter((part) => part.type === "file");
  const footerButtonClassName =
    "h-7 w-7 rounded-full text-[#7e7368] hover:bg-[#efe5d7] hover:text-[#2f261f]";
  const contentWidthClassName = isEditing
    ? "w-full max-w-[94%]"
    : "max-w-[82%]";
  const bubbleClassName = isEditing
    ? "w-full rounded-xl border border-[#d8cfbf] bg-[#fffdf9] px-4 py-3 text-[15px] leading-6 text-[#332a22] shadow-[0_8px_24px_rgba(64,48,31,0.06)] focus-within:border-[#c28b63] focus-within:ring-2 focus-within:ring-[#c28b63]/20"
    : "max-w-full rounded-2xl bg-[#e9dcc7] px-4 py-3 text-[15px] leading-6 text-[#332a22] shadow-sm";
  const canSaveEdit = Boolean(editingText.trim() || attachments.length > 0 || pageContexts.length > 0);

  useAutosizeTextArea(editInputRef, isEditing ? editingText : text);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isEditing) return;

    const input = editInputRef.current;
    if (!input) return;

    const frame = window.requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isEditing]);

  const handleCopy = () => {
    if (!text) return;

    void navigator.clipboard
      .writeText(text)
      .then(() => {
        if (copyResetTimeoutRef.current !== null) {
          window.clearTimeout(copyResetTimeoutRef.current);
        }

        setCopyFeedbackVisible(true);
        copyResetTimeoutRef.current = window.setTimeout(() => {
          copyResetTimeoutRef.current = null;
          setCopyFeedbackVisible(false);
        }, 1600);
      })
      .catch((error) => {
        console.error("[UserMessage] Failed to copy message", error);
      });
  };

  return (
    <div className="group flex justify-end">
      <div
        className={[
          "relative flex flex-col items-end",
          contentWidthClassName,
        ].join(" ")}
      >
        {(pageContexts.length > 0 || attachments.length > 0) && (
          <div className="mb-2 flex max-w-full flex-wrap justify-end gap-2">
            {pageContexts.map((part, index) => (
              <PageContextBadge
                key={part.id || `${part.title || "page"}-${index}`}
                part={part}
              />
            ))}

            {attachments.map((attachment, index) => {
              const label = attachment.filename || t("sidepanel.attachment");
              const size = formatFileSize(attachment.size);
              const isImage = attachment.mediaType?.startsWith("image/");

              return isImage && attachment.dataUrl ? (
                <button
                  key={attachment.id || `${label}-${index}`}
                  type="button"
                  className="relative h-20 w-20 overflow-hidden rounded-xl border border-[#d8cfbf] bg-[#fffaf4]/80 shadow-[0_6px_18px_rgba(64,48,31,0.08)]"
                  aria-label={t("sidepanel.previewLabel", { label })}
                  title={label}
                  onClick={() => setPreviewUrl(attachment.dataUrl!)}
                >
                  <img
                    src={attachment.dataUrl}
                    alt={label}
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : (
                <div
                  key={attachment.id || `${label}-${index}`}
                  className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg bg-[#fffaf4]/70 px-2 py-1 text-xs text-[#5f5347]"
                >
                  <Paperclip className="size-4 shrink-0 text-[#6f6254]" />
                  <span className="max-w-[180px] truncate font-medium">
                    {label}
                  </span>
                  {size && (
                    <span className="shrink-0 text-[#6f6254]">{size}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(text || isEditing) && (
          <div className={bubbleClassName}>
            {isEditing ? (
              <textarea
                ref={editInputRef}
                aria-label={t("sidepanel.editMessageText")}
                className="min-h-[104px] w-full resize-none overflow-y-auto bg-transparent text-[15px] leading-6 text-[#332a22] outline-none placeholder:text-[#8f8172]"
                placeholder={t("sidepanel.editMessage")}
                rows={1}
                value={editingText}
                onChange={(event) => onEditingTextChange?.(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelEdit?.();
                    return;
                  }

                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey) &&
                    canSaveEdit
                  ) {
                    event.preventDefault();
                    onSaveEdit?.(message.id);
                  }
                }}
              />
            ) : text ? (
              <div className="whitespace-pre-wrap">
                <HighlightedPromptText
                  promptClassName="font-semibold text-[#a34020]"
                  promptPrefix={display.promptPrefix}
                  text={text}
                />
              </div>
            ) : null}
          </div>
        )}

        <div className="absolute right-0 top-full z-10 translate-y-1">
          <MessageFooter
            align="right"
            actionsVisibility="hover"
            createdAt={message.createdAt}
          >
            {isEditing ? (
              <>
                <IconButton
                  className={footerButtonClassName}
                  label={t("sidepanel.cancelEdit")}
                  onClick={onCancelEdit}
                >
                  <X className="size-4" />
                </IconButton>
                <IconButton
                  className={footerButtonClassName}
                  disabled={!canSaveEdit || isRunning}
                  label={t("sidepanel.saveEdit")}
                  onClick={() => onSaveEdit?.(message.id)}
                >
                  <Check className="size-4" />
                </IconButton>
              </>
            ) : (
              <>
                <IconButton
                  active={copyFeedbackVisible}
                  className={footerButtonClassName}
                  disabled={!text}
                  label={copyFeedbackVisible ? t("common.copied") : t("common.copy")}
                  onClick={handleCopy}
                >
                  {copyFeedbackVisible ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </IconButton>
                {onEdit && (
                  <IconButton
                    className={footerButtonClassName}
                    disabled={isRunning}
                    label={t("sidepanel.editMessage")}
                    onClick={() => onEdit(message.id)}
                  >
                    <PencilLine className="size-4" />
                  </IconButton>
                )}
              </>
            )}
          </MessageFooter>
        </div>

        {previewUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f261f]/60"
            onClick={() => setPreviewUrl(null)}
          >
            <button
              type="button"
              aria-label={t("sidepanel.closePreview")}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#2f261f]/60 text-white transition-colors hover:bg-[#2f261f]/90"
              onClick={() => setPreviewUrl(null)}
            >
              <X className="size-5" />
            </button>
            <img
              src={previewUrl}
              alt={t("sidepanel.previewLabel", { label: t("sidepanel.attachment") })}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-lg"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export const UserMessage = React.memo(UserMessageImpl);
UserMessage.displayName = "UserMessage";
