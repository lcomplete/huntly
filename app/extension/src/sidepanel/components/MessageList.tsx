import type { FC } from "react";
import type { ChatMessage } from "../types";
import { AssistantMessage } from "./AssistantMessage";
import { UserMessage } from "./UserMessage";

interface MessageListProps {
  editingUserMessageId?: string | null;
  editingUserMessageText?: string;
  messages: ChatMessage[];
  isRunning: boolean;
  thinkingMode: boolean;
  statusAction?: "retry" | "compact" | null;
  onCancelUserMessageEdit?: () => void;
  onCompactContext?: () => void;
  onEditUserMessage?: (messageId: string) => void;
  onEditUserMessageTextChange?: (value: string) => void;
  onRegenerate?: (messageId: string) => void;
  onRetryLastRun?: () => void;
  onSaveUserMessageEdit?: (messageId: string) => void;
  endRef: React.RefObject<HTMLDivElement>;
}

export const MessageList: FC<MessageListProps> = ({
  editingUserMessageId,
  editingUserMessageText,
  messages,
  isRunning,
  thinkingMode,
  statusAction = null,
  onCancelUserMessageEdit,
  onCompactContext,
  onEditUserMessage,
  onEditUserMessageTextChange,
  onRegenerate,
  onRetryLastRun,
  onSaveUserMessageEdit,
  endRef,
}) => {
  const lastIndex = messages.length - 1;
  return (
    <div className="min-h-full px-5 py-6">
      <div className="mx-auto flex max-w-[760px] flex-col gap-4">
        {messages.map((message, index) => {
          if (message.role === "user") {
            return (
              <UserMessage
                key={message.id}
                editingText={editingUserMessageText}
                isRunning={isRunning}
                isEditing={editingUserMessageId === message.id}
                message={message}
                onCancelEdit={onCancelUserMessageEdit}
                onEdit={onEditUserMessage}
                onEditingTextChange={onEditUserMessageTextChange}
                onSaveEdit={onSaveUserMessageEdit}
              />
            );
          }
          const isLast = index === lastIndex;
          return (
            <AssistantMessage
              key={message.id}
              isLast={isLast}
              isRunning={isRunning && isLast}
              message={message}
              statusAction={statusAction}
              onCompactContext={onCompactContext}
              onRegenerate={onRegenerate}
              onRetryLastRun={onRetryLastRun}
              thinkingMode={thinkingMode}
            />
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
};
