import React, { useState, type FC } from "react";
import { ChevronDown, ExternalLink, Link2 } from "lucide-react";
import type { LinkCardGroup } from "../utils/messageParts";
import { formatTabHost } from "../utils/format";

interface LinkCardsBlockProps {
  groups: LinkCardGroup[];
}

interface LinkCardGroupSectionProps {
  group: LinkCardGroup;
}

const LinkCardGroupSection: FC<LinkCardGroupSectionProps> = ({ group }) => {
  const [open, setOpen] = useState(Boolean(group.defaultOpen));

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-[#e7ded0] bg-[linear-gradient(180deg,rgba(255,253,248,0.96),rgba(249,243,233,0.9))] shadow-[0_1px_0_rgba(47,38,31,0.04)]">
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-[#f6efe5]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b18d]"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#f1e4d2] text-[#9a5a30]">
          <Link2 className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-5 text-[#332a22]">
            {group.title}
          </div>
          <div className="text-[11px] leading-4 text-[#7b6c5d]">
            {group.items.length} link{group.items.length === 1 ? "" : "s"}
          </div>
        </div>
        <ChevronDown
          className={[
            "size-3.5 shrink-0 text-[#7b6c5d] transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open && (
        <div className="space-y-1.5 border-t border-[#eee3d2] p-2.5">
          {group.items.map((item) => {
            const secondary = item.meta || formatTabHost(item.href);

            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-lg border border-[#e7ded0] bg-[#fffdf9] p-2.5 transition-all hover:border-[#d8b18d] hover:bg-[#fff8ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b18d]"
              >
                <div className="flex items-start gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium leading-5 text-[#332a22] group-hover:text-[#2f261f]">
                      {item.title}
                    </div>
                    {secondary && (
                      <div className="mt-0.5 text-[11px] leading-4 text-[#7b6c5d]">
                        {secondary}
                      </div>
                    )}
                    {item.description && (
                      <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#5f5347]">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-[#9a5a30]" />
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

const LinkCardsBlockImpl: FC<LinkCardsBlockProps> = ({ groups }) => {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {groups.map((group) => (
        <LinkCardGroupSection key={group.id} group={group} />
      ))}
    </div>
  );
};

export const LinkCardsBlock = React.memo(LinkCardsBlockImpl);
LinkCardsBlock.displayName = "LinkCardsBlock";