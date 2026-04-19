import React, { useMemo, type FC } from "react";
import { Copy, RotateCcw } from "lucide-react";
import type { ChatMessage } from "../types";
import { extractSources, getMessageText } from "../utils/messageParts";
import { IconButton } from "./IconButton";
import { MarkdownContent } from "./MarkdownContent";
import { ReasoningBlock } from "./ReasoningBlock";
import { SourcesBlock } from "./SourcesBlock";
import { ToolCallBlock } from "./ToolCallBlock";

interface AssistantMessageProps {
  message: ChatMessage;
  isLast: boolean;
  isRunning: boolean;
  thinkingMode: boolean;
  onRegenerate?: () => void;
}

const AssistantMessageImpl: FC<AssistantMessageProps> = ({
  message,
  isLast,
  isRunning,
  thinkingMode,
  onRegenerate,
}) => {
  const hasReasoningText = message.parts.some(
    (part) => part.type === "reasoning" && part.text?.trim()
  );
  const showThinkingPreview =
    thinkingMode && isLast && isRunning && !hasReasoningText;
  const sources = useMemo(() => extractSources(message.parts), [message.parts]);
  const text = useMemo(() => getMessageText(message.parts), [message.parts]);

  return (
    <div className="group flex gap-3">
      <div className="min-w-0 flex-1">
        <SourcesBlock sources={sources} />
        {showThinkingPreview && (
          <ReasoningBlock streaming={true} text="Thinking..." />
        )}

        {message.parts.map((part, index) => {
          if (part.type === "reasoning") {
            if (!part.text?.trim()) return null;

            return (
              <ReasoningBlock
                key={part.id || `${message.id}-${index}`}
                streaming={
                  isLast && isRunning && index === message.parts.length - 1
                }
                text={part.text}
              />
            );
          }
          if (part.type === "tool-call") {
            return <ToolCallBlock key={part.toolCallId || index} part={part} />;
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

        {isLast && isRunning && message.parts.length === 0 && (
          <div className="flex h-8 items-center gap-1">
            <span className="claude-dot" />
            <span className="claude-dot [animation-delay:120ms]" />
            <span className="claude-dot [animation-delay:240ms]" />
          </div>
        )}

        {isLast && !isRunning && (
          <div className="mt-3 flex items-center gap-1">
            <IconButton
              disabled={!text}
              label="Copy"
              onClick={() => {
                if (text) void navigator.clipboard.writeText(text);
              }}
            >
              <Copy className="size-4" />
            </IconButton>
            {onRegenerate && (
              <IconButton label="Regenerate" onClick={onRegenerate}>
                <RotateCcw className="size-4" />
              </IconButton>
            )}
          </div>
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
    prev.onRegenerate === next.onRegenerate
);
AssistantMessage.displayName = "AssistantMessage";
