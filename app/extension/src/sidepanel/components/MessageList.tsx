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
  onCancelUserMessageEdit?: () => void;
  onEditUserMessage?: (messageId: string) => void;
  onEditUserMessageTextChange?: (value: string) => void;
  onRegenerate?: (messageId: string) => void;
  onSaveUserMessageEdit?: (messageId: string) => void;
  endRef: React.RefObject<HTMLDivElement>;
}

export const MessageList: FC<MessageListProps> = ({
  editingUserMessageId,
  editingUserMessageText,
  messages,
  isRunning,
  thinkingMode,
  onCancelUserMessageEdit,
  onEditUserMessage,
  onEditUserMessageTextChange,
  onRegenerate,
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
              onRegenerate={onRegenerate}
              thinkingMode={thinkingMode}
            />
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
};
