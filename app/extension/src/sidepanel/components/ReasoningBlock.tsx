import React, { type FC } from "react";
import { Brain, ChevronDown } from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";

interface ReasoningBlockProps {
  text: string;
  streaming: boolean;
}

const ReasoningBlockImpl: FC<ReasoningBlockProps> = ({ text, streaming }) => (
  <details
    className="reasoning-block mb-4 overflow-hidden rounded-lg border border-[#ded4c4] bg-[#f4efe6]/80 shadow-sm"
    open={streaming}
  >
    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-[#5f5347] transition-colors hover:bg-[#eee7dc]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#fffaf4] text-[#9a4f2c] shadow-sm">
        <Brain className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-[#332a22]">
          {streaming ? "Thinking" : "Thoughts"}
        </span>
        <span className="block truncate text-xs text-[#6f6254]">
          {streaming ? "Running" : "Complete"}
        </span>
      </span>
      {streaming ? (
        <span className="flex shrink-0 gap-1" aria-hidden="true">
          <span className="claude-dot" />
          <span className="claude-dot [animation-delay:120ms]" />
          <span className="claude-dot [animation-delay:240ms]" />
        </span>
      ) : (
        <ChevronDown
          aria-hidden="true"
          className="reasoning-chevron size-4 shrink-0 text-[#6f6254]"
        />
      )}
    </summary>
    <div className="border-t border-[#e2d8c9] bg-[#fffaf4]/70">
      <MarkdownContent
        className="claude-markdown max-h-64 overflow-y-auto px-3 py-3 text-sm leading-6 text-[#5f5347]"
        text={text || "Thinking..."}
      />
    </div>
  </details>
);

export const ReasoningBlock = React.memo(ReasoningBlockImpl);
ReasoningBlock.displayName = "ReasoningBlock";
