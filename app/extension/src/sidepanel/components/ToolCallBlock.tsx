import React, { useMemo, useState, type FC } from "react";
import { ChevronDown, Wrench } from "lucide-react";
import type { ChatPart } from "../types";
import { prettyPrint } from "../utils/format";

interface ToolCallBlockProps {
  part: ChatPart;
}

const JSON_PREVIEW_LIMIT = 4000;

interface TruncatedJsonProps {
  value: unknown;
}

const TruncatedJson: FC<TruncatedJsonProps> = ({ value }) => {
  const [expanded, setExpanded] = useState(false);
  const text = useMemo(() => prettyPrint(value), [value]);
  const isTruncated = text.length > JSON_PREVIEW_LIMIT;
  const visible =
    !isTruncated || expanded ? text : `${text.slice(0, JSON_PREVIEW_LIMIT)}…`;

  return (
    <>
      <pre className="max-h-52 overflow-auto rounded-lg bg-[#2f261f] p-3 text-xs leading-5 text-[#fffaf4]">
        {visible}
      </pre>
      {isTruncated && (
        <button
          type="button"
          className="mt-1 text-[11px] font-semibold text-[#9a4f2c] hover:underline"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded
            ? "Show less"
            : `Show all (${text.length.toLocaleString()} chars)`}
        </button>
      )}
    </>
  );
};

const ToolCallBlockImpl: FC<ToolCallBlockProps> = ({ part }) => {
  const [open, setOpen] = useState(false);
  const complete = part.result !== undefined;
  const error = Boolean(part.isError);
  const input = useMemo(
    () => part.args || part.argsText || {},
    [part.args, part.argsText]
  );

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-[#ded4c4] bg-[#fffaf4]/80">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#5f5347] transition-colors hover:bg-[#f4efe6]"
        onClick={() => setOpen((value) => !value)}
      >
        <Wrench className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {part.toolName || "Tool call"}
        </span>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            error
              ? "bg-[#f4d7cc] text-[#a34020]"
              : complete
              ? "bg-[#e6ead5] text-[#5d6a2e]"
              : "bg-[#f1e4d2] text-[#9a5a30]",
          ].join(" ")}
        >
          {error ? "Error" : complete ? "Done" : "Running"}
        </span>
        <ChevronDown
          className={[
            "size-3.5 shrink-0 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>
      {open && (
        <div className="space-y-3 border-t border-[#e7ded0] p-3">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6f6254]">
              Input
            </div>
            <TruncatedJson value={input} />
          </div>
          {part.result !== undefined && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6f6254]">
                Output
              </div>
              <TruncatedJson value={part.result} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ToolCallBlock = React.memo(ToolCallBlockImpl);
ToolCallBlock.displayName = "ToolCallBlock";
