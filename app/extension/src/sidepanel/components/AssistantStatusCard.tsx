import {
  AlertTriangle,
  FoldVertical,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { FC } from "react";

import { MarkdownContent } from "./MarkdownContent";
import type { ChatPart, ChatErrorCode } from "../types";
import { useI18n } from "../../i18n";

interface AssistantStatusCardProps {
  part: ChatPart;
  actionable: boolean;
  busyAction?: "retry" | "compact" | null;
  onCompactContext?: () => void;
  onRetryLastRun?: () => void;
}

function resolveErrorCopy(
  errorCode: ChatErrorCode | undefined,
  t: ReturnType<typeof useI18n>["t"]
) {
  switch (errorCode) {
    case "context-overflow":
      return {
        title: t("sidepanel.error.contextOverflowTitle"),
        description: t("sidepanel.error.contextOverflowDescription"),
      };
    case "auth":
      return {
        title: t("sidepanel.error.authTitle"),
        description: t("sidepanel.error.authDescription"),
      };
    case "quota":
      return {
        title: t("sidepanel.error.quotaTitle"),
        description: t("sidepanel.error.quotaDescription"),
      };
    case "network":
      return {
        title: t("sidepanel.error.networkTitle"),
        description: t("sidepanel.error.networkDescription"),
      };
    case "timeout":
      return {
        title: t("sidepanel.error.timeoutTitle"),
        description: t("sidepanel.error.timeoutDescription"),
      };
    default:
      return {
        title: t("sidepanel.error.unknownTitle"),
        description: t("sidepanel.error.unknownDescription"),
      };
  }
}

export const AssistantStatusCard: FC<AssistantStatusCardProps> = ({
  part,
  actionable,
  busyAction = null,
  onCompactContext,
  onRetryLastRun,
}) => {
  const { t } = useI18n();

  if (part.type !== "status") {
    return null;
  }

  if (part.statusKind === "compacting") {
    return (
      <div className="my-3 rounded-2xl border border-[#e2d5bc] bg-[#fff8ec] px-4 py-3 text-[#5f5347] shadow-[0_10px_28px_rgba(64,48,31,0.08)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-[#f1e4d2] p-2 text-[#9a5a30]">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#3f342a]">
              {t("sidepanel.status.compactingTitle")}
            </div>
            <p className="mt-1 text-sm leading-6 text-[#6f6254]">
              {t("sidepanel.status.compactingDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (part.statusKind === "compacted") {
    return (
      <div className="my-3 rounded-2xl border border-[#d7dec7] bg-[#f8fbf2] px-4 py-3 text-[#40512a] shadow-[0_10px_28px_rgba(64,48,31,0.08)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-[#e6ead5] p-2 text-[#5d6a2e]">
            <FoldVertical className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#32411d]">
              {t("sidepanel.status.compactedTitle")}
            </div>
            <p className="mt-1 text-sm leading-6 text-[#55663b]">
              {t("sidepanel.status.compactedDescription", {
                count: part.compactedMessageCount || 0,
              })}
            </p>
            {part.summary?.trim() && (
              <div className="mt-3 rounded-xl border border-[#d7dec7] bg-[#ffffffb8] px-3 py-2">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#718055]">
                  {t("sidepanel.status.summaryLabel")}
                </div>
                <MarkdownContent
                  className="claude-markdown text-[13px] leading-6 text-[#465632]"
                  text={part.summary}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const copy = resolveErrorCopy(part.errorCode, t);
  const actionsDisabled = Boolean(busyAction);
  const actionButtonClass =
    "inline-flex min-h-10 items-center gap-2 rounded-full border border-[#d9b1a4] bg-[#fffaf4] px-3 py-1.5 text-sm font-medium text-[#8a341c] transition-colors hover:bg-[#fff1ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34020] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff3ef] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[#fffaf4]";

  return (
    <div className="my-3 rounded-2xl border border-[#ebcbbf] bg-[#fff3ef] px-4 py-3 text-[#5f3c31] shadow-[0_10px_28px_rgba(64,48,31,0.08)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-[#f4d7cc] p-2 text-[#a34020]">
          <AlertTriangle className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#6f2f1c]">
            {copy.title}
          </div>
          <p className="mt-1 text-sm leading-6 text-[#7f5748]">
            {copy.description}
          </p>
          {part.details?.trim() && (
            <div className="mt-3 rounded-xl border border-[#ebcbbf] bg-[#fffaf4] px-3 py-2">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a5b43]">
                {t("sidepanel.error.detailsLabel")}
              </div>
              <pre className="overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-[#7f5748]">
                {part.details}
              </pre>
            </div>
          )}
          {actionable && (part.retryable || part.canCompact) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {part.retryable && onRetryLastRun && (
                <button
                  type="button"
                  aria-busy={busyAction === "retry"}
                  className={actionButtonClass}
                  disabled={actionsDisabled}
                  onClick={onRetryLastRun}
                >
                  {busyAction === "retry" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  {t("common.retry")}
                </button>
              )}
              {part.canCompact && onCompactContext && (
                <button
                  type="button"
                  aria-busy={busyAction === "compact"}
                  className={actionButtonClass}
                  disabled={actionsDisabled}
                  onClick={onCompactContext}
                >
                  {busyAction === "compact" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <FoldVertical className="size-3.5" />
                  )}
                  {t("sidepanel.error.compactContext")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
