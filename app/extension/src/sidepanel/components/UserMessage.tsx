import React, { useMemo, type FC } from "react";
import { Paperclip } from "lucide-react";
import type { ChatMessage } from "../types";
import { formatFileSize } from "../utils/format";
import { getDisplayMessage } from "../utils/messageParts";
import { HighlightedPromptText } from "./HighlightedPromptText";
import { PageContextBadge } from "./PageContextBadge";

interface UserMessageProps {
  message: ChatMessage;
}

const UserMessageImpl: FC<UserMessageProps> = ({ message }) => {
  const display = useMemo(() => getDisplayMessage(message.parts), [
    message.parts,
  ]);
  const text = display.text;
  const pageContexts = message.parts.filter(
    (part) => part.type === "page-context"
  );
  const attachments = message.parts.filter((part) => part.type === "file");

  return (
    <div className="flex justify-end">
      <div className="flex max-w-[82%] flex-col items-end">
        {(text || attachments.length > 0) && (
          <div className="max-w-full rounded-2xl bg-[#e9dcc7] px-4 py-3 text-[15px] leading-6 text-[#332a22] shadow-sm">
            {text && (
              <div className="whitespace-pre-wrap">
                <HighlightedPromptText
                  promptClassName="font-semibold text-[#a34020]"
                  promptPrefix={display.promptPrefix}
                  text={text}
                />
              </div>
            )}
            {attachments.length > 0 && (
              <div
                className={["flex flex-wrap gap-2", text ? "mt-2" : ""].join(
                  " "
                )}
              >
                {attachments.map((attachment, index) => {
                  const label = attachment.filename || "Attachment";
                  const size = formatFileSize(attachment.size);
                  return (
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
          </div>
        )}
        {pageContexts.length > 0 && (
          <div className="mt-2 flex max-w-full flex-wrap justify-end gap-2">
            {pageContexts.map((part, index) => (
              <PageContextBadge
                key={part.id || `${part.title || "page"}-${index}`}
                part={part}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const UserMessage = React.memo(UserMessageImpl);
UserMessage.displayName = "UserMessage";
