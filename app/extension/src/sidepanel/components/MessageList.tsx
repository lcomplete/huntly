import type { FC } from "react";
import type { ChatMessage } from "../types";
import { AssistantMessage } from "./AssistantMessage";
import { UserMessage } from "./UserMessage";

interface MessageListProps {
  messages: ChatMessage[];
  isRunning: boolean;
  thinkingMode: boolean;
  onRegenerate?: () => void;
  endRef: React.RefObject<HTMLDivElement>;
}

export const MessageList: FC<MessageListProps> = ({
  messages,
  isRunning,
  thinkingMode,
  onRegenerate,
  endRef,
}) => {
  const lastIndex = messages.length - 1;
  return (
    <div className="min-h-full px-5 py-6">
      <div className="mx-auto flex max-w-[760px] flex-col gap-8">
        {messages.map((message, index) => {
          if (message.role === "user") {
            return <UserMessage key={message.id} message={message} />;
          }
          const isLast = index === lastIndex;
          return (
            <AssistantMessage
              key={message.id}
              isLast={isLast}
              isRunning={isRunning && isLast}
              message={message}
              onRegenerate={isLast ? onRegenerate : undefined}
              thinkingMode={thinkingMode}
            />
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
};
