import React, { useEffect, useMemo, useRef, useState, type FC } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { MessageFooter } from "./MessageFooter";
import type { ChatMessage } from "../types";
import { extractLinkCardGroups, getMessageText } from "../utils/messageParts";
import { AssistantStatusCard } from "./AssistantStatusCard";
import { IconButton } from "./IconButton";
import { LinkCardsBlock } from "./LinkCardsBlock";
import { MarkdownContent } from "./MarkdownContent";
import { ReasoningBlock } from "./ReasoningBlock";
import { ToolCallBlock } from "./ToolCallBlock";
import { useI18n } from "../../i18n";

interface AssistantMessageProps {
  message: ChatMessage;
  isLast: boolean;
  isRunning: boolean;
  thinkingMode: boolean;
  statusAction?: "retry" | "compact" | null;
  onCompactContext?: () => void;
  onRegenerate?: (messageId: string) => void;
  onRetryLastRun?: () => void;
}

function findLastResponseTextIndex(message: ChatMessage): number {
  for (let index = message.parts.length - 1; index >= 0; index -= 1) {
    const part = message.parts[index];
    if (part.type === "text" && part.text?.trim()) {
      return index;
    }
  }

  return -1;
}

const AssistantMessageImpl: FC<AssistantMessageProps> = ({
  message,
  isLast,
  isRunning,
  thinkingMode,
  statusAction = null,
  onCompactContext,
  onRegenerate,
  onRetryLastRun,
}) => {
  const { t } = useI18n();
  const hasReasoningText = message.parts.some(
    (part) => part.type === "reasoning" && part.text?.trim()
  );
  const hasOnlyStatusParts =
    message.parts.length > 0 &&
    message.parts.every((part) => part.type === "status");
  const text = useMemo(() => getMessageText(message.parts), [message.parts]);
  const lastResponseTextIndex = useMemo(
    () => findLastResponseTextIndex(message),
    [message]
  );
  const showThinkingPreview =
    thinkingMode && isLast && isRunning && !hasReasoningText;
  const showPreparingResponse =
    isLast &&
    isRunning &&
    (lastResponseTextIndex === -1 ||
      lastResponseTextIndex < message.parts.length - 1);
  const [copyFeedbackVisible, setCopyFeedbackVisible] = useState(false);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const footerButtonClassName =
    "h-7 w-7 rounded-full text-[#7e7368] hover:bg-[#ede4d7] hover:text-[#2f261f]";

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

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
        console.error("[AssistantMessage] Failed to copy message", error);
      });
  };

  return (
    <div className="group flex gap-3">
      <div className="min-w-0 flex-1">
        {showThinkingPreview && (
          <ReasoningBlock
            streaming={true}
            text={`${t("common.thinking")}...`}
          />
        )}

        {message.parts.map((part, index) => {
          if (part.type === "step-start") {
            return index > 0 ? (
              <div key={`${message.id}-${index}`} className="my-2">
                <hr className="border-[#e7ded0]" />
              </div>
            ) : null;
          }
          if (part.type === "reasoning") {
            if (!part.text?.trim()) return null;

            return (
              <ReasoningBlock
                key={part.id || `${message.id}-${index}`}
                streaming={Boolean(part.streaming)}
                text={part.text}
              />
            );
          }
          if (part.type === "tool-call") {
            const linkCardGroups = extractLinkCardGroups(part);

            return (
              <React.Fragment key={part.toolCallId || `${message.id}-${index}`}>
                <ToolCallBlock part={part} />
                <LinkCardsBlock groups={linkCardGroups} />
              </React.Fragment>
            );
          }
          if (part.type === "status") {
            return (
              <AssistantStatusCard
                key={part.id || `${message.id}-${index}`}
                actionable={Boolean(isLast && !isRunning)}
                busyAction={statusAction}
                onCompactContext={onCompactContext}
                onRetryLastRun={onRetryLastRun}
                part={part}
              />
            );
          }
          if (part.type === "text" && part.text?.trim()) {
            return (
              <MarkdownContent
                key={`${message.id}-${index}`}
                className="claude-markdown text-[15px] leading-7 text-[#332a22]"
                text={part.text}
              />
            );
          }
          return null;
        })}

        {showPreparingResponse && (
          <div
            role="status"
            aria-label={t("common.loading")}
            className="inline-flex h-8 items-center justify-center px-1"
          >
            <span aria-hidden="true" className="flex items-center gap-1">
              <span className="claude-dot" />
              <span className="claude-dot [animation-delay:120ms]" />
              <span className="claude-dot [animation-delay:240ms]" />
            </span>
          </div>
        )}

        {!(isLast && isRunning) && !hasOnlyStatusParts && (
          <MessageFooter actionsVisibility="always">
            <IconButton
              disabled={!text}
              active={copyFeedbackVisible}
              className={footerButtonClassName}
              label={
                copyFeedbackVisible ? t("common.copied") : t("common.copy")
              }
              onClick={handleCopy}
            >
              {copyFeedbackVisible ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
            </IconButton>
            {onRegenerate && (
              <IconButton
                className={footerButtonClassName}
                label={t("sidepanel.retryResponse")}
                onClick={() => onRegenerate(message.id)}
              >
                <RotateCcw className="size-4" />
              </IconButton>
            )}
          </MessageFooter>
        )}
      </div>
    </div>
  );
};

export const AssistantMessage = React.memo(
  AssistantMessageImpl,
  (prev, next) =>
    prev.message === next.message &&
    prev.isLast === next.isLast &&
    prev.isRunning === next.isRunning &&
    prev.thinkingMode === next.thinkingMode &&
    prev.statusAction === next.statusAction &&
    prev.onCompactContext === next.onCompactContext &&
    prev.onRegenerate === next.onRegenerate &&
    prev.onRetryLastRun === next.onRetryLastRun
);
AssistantMessage.displayName = "AssistantMessage";
