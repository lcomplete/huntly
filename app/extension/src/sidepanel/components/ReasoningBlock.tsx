import React, { type FC } from "react";
import { ChevronRight } from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";
import { useI18n } from "../../i18n";

interface ReasoningBlockProps {
  text: string;
  streaming: boolean;
}

const ReasoningBlockImpl: FC<ReasoningBlockProps> = ({ text, streaming }) => {
  const { t } = useI18n();

  return (
    <details
      className="reasoning-block group mb-3 rounded-md border-l-2 border-[#d8cfbf] bg-transparent"
      open={streaming}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#8a7d6d] transition-colors hover:text-[#5f5347]">
        <ChevronRight
          aria-hidden="true"
          className="reasoning-chevron size-3.5 shrink-0 transition-transform"
        />
        <span className="font-medium">
          {streaming ? t("common.thinking") : t("sidepanel.reasoning.thoughts")}
        </span>
      </summary>
      <MarkdownContent
        className="claude-markdown max-h-64 overflow-y-auto px-3 pb-2 pt-1 text-[13px] leading-6 text-[#6f6254]"
        text={text || `${t("common.thinking")}...`}
      />
    </details>
  );
};

export const ReasoningBlock = React.memo(ReasoningBlockImpl);
ReasoningBlock.displayName = "ReasoningBlock";
