import React, { type FC } from "react";
import { ExternalLink } from "lucide-react";
import type { ExtractedSource } from "../utils/messageParts";

interface SourcesBlockProps {
  sources: ExtractedSource[];
}

const SourcesBlockImpl: FC<SourcesBlockProps> = ({ sources }) => {
  if (sources.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {sources.map((source) => (
        <a
          key={source.href}
          href={source.href}
          target="_blank"
          rel="noreferrer"
          className="flex max-w-full items-center gap-1.5 rounded-full border border-[#ded4c4] bg-[#fffaf4]/80 px-3 py-1.5 text-xs font-medium text-[#6f6254] transition-colors hover:border-[#d8b18d] hover:text-[#2f261f]"
        >
          <ExternalLink className="size-4 shrink-0" />
          <span className="truncate">{source.title}</span>
        </a>
      ))}
    </div>
  );
};

export const SourcesBlock = React.memo(SourcesBlockImpl);
SourcesBlock.displayName = "SourcesBlock";
