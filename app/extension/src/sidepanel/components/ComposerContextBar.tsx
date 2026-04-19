import type { FC } from "react";
import { Loader2, Plus, X } from "lucide-react";
import type { TabContext } from "../utils/tabContext";
import { TabFavicon } from "./TabFavicon";

interface ComposerContextBarProps {
  tabContext: TabContext | null;
  contextAttached: boolean;
  contextError: string | null;
  contextLoading: boolean;
  onAttachContext: () => void;
  onDetachContext: () => void;
}

export const ComposerContextBar: FC<ComposerContextBarProps> = ({
  tabContext,
  contextAttached,
  contextError,
  contextLoading,
  onAttachContext,
  onDetachContext,
}) => {
  const label = contextError || tabContext?.title || "Current tab";
  const containerClassName = [
    "mr-3 flex min-w-0 max-w-[min(360px,calc(100%-120px))] items-center gap-1.5 rounded-lg bg-[#fffaf4]/80 px-1.5 py-1 pr-3 shadow-[0_6px_18px_rgba(64,48,31,0.06)] transition-colors",
    contextAttached
      ? "border border-solid border-[#d8cfbf]"
      : "border border-dashed border-[#d8b18d]",
  ].join(" ");
  const tabContextDetails = (
    <>
      <TabFavicon
        faviconUrl={tabContext?.faviconUrl}
        muted={!contextAttached}
        title={tabContext?.title}
      />
      <span
        className={[
          "min-w-0 flex-1 truncate text-xs font-medium leading-5",
          contextError
            ? "text-[#a34020]"
            : contextAttached
            ? "text-[#3c3027]"
            : "italic text-[#6f6254]",
        ].join(" ")}
      >
        {label}
      </span>
    </>
  );

  if (!contextAttached) {
    return (
      <button
        type="button"
        aria-label="Add current tab context"
        title="Add current tab context"
        disabled={contextLoading || !tabContext}
        className={[
          containerClassName,
          "cursor-pointer text-left hover:bg-[#fff5e8] disabled:cursor-not-allowed disabled:opacity-70",
        ].join(" ")}
        onClick={onAttachContext}
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#6f6254]">
          {contextLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
        </div>
        {tabContextDetails}
      </button>
    );
  }

  return (
    <div className={containerClassName}>
      <div className="flex h-6 w-6 shrink-0 items-center justify-center">
        <button
          type="button"
          aria-label="Remove attached context"
          title="Remove attached context"
          className="flex h-6 w-6 items-center justify-center rounded-md text-[#75695b] transition-colors hover:bg-[#f1e8da] hover:text-[#2f261f]"
          onClick={onDetachContext}
        >
          <X className="size-3.5" />
        </button>
      </div>
      {tabContextDetails}
    </div>
  );
};
