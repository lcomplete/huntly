import type { FC } from "react";
import type { ChatPart } from "../types";
import { formatTabHost } from "../utils/format";
import { TabFavicon } from "./TabFavicon";

interface PageContextBadgeProps {
  part: ChatPart;
}

const PAGE_CONTEXT_BADGE_CLASS =
  "flex min-w-0 max-w-[min(360px,100%)] items-center gap-2 rounded-lg border border-solid border-[#d8cfbf] bg-[#fffaf4]/70 px-2 py-1.5 text-xs text-[#5f5347] no-underline shadow-sm hover:no-underline";

export const PageContextBadge: FC<PageContextBadgeProps> = ({ part }) => {
  const content = (
    <>
      <TabFavicon faviconUrl={part.faviconUrl} title={part.title} />
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium text-[#3c3027]">
          {part.title || "Attached page"}
        </span>
        {part.url && (
          <span className="block truncate text-[11px] leading-4 text-[#75695b]">
            {formatTabHost(part.url)}
          </span>
        )}
      </div>
    </>
  );

  if (part.url) {
    return (
      <a
        href={part.url}
        target="_blank"
        rel="noreferrer"
        className={PAGE_CONTEXT_BADGE_CLASS}
      >
        {content}
      </a>
    );
  }

  return <div className={PAGE_CONTEXT_BADGE_CLASS}>{content}</div>;
};
