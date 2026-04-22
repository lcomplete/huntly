import type { FC, ReactNode } from "react";

interface MessageFooterProps {
  align?: "left" | "right";
  actionsVisibility?: "always" | "hover";
  collapseWhenHidden?: boolean;
  createdAt?: string;
  children?: ReactNode;
}

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const SHORT_DATE_WITH_YEAR_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const FULL_DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function parseMessageDate(value?: string): Date | null {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatFooterDate(value?: string): {
  shortLabel: string;
  fullLabel: string;
} | null {
  const parsed = parseMessageDate(value);
  if (!parsed) return null;

  const sameYear = parsed.getFullYear() === new Date().getFullYear();
  return {
    shortLabel: sameYear
      ? SHORT_DATE_FORMAT.format(parsed)
      : SHORT_DATE_WITH_YEAR_FORMAT.format(parsed),
    fullLabel: FULL_DATE_TIME_FORMAT.format(parsed),
  };
}

export const MessageFooter: FC<MessageFooterProps> = ({
  align = "left",
  actionsVisibility = "always",
  collapseWhenHidden = false,
  createdAt,
  children,
}) => {
  const formattedDate = formatFooterDate(createdAt);
  const shouldHoverReveal = actionsVisibility === "hover";

  if (!formattedDate && !children) {
    return null;
  }

  return (
    <div
      className={[
        "flex w-max max-w-none flex-nowrap items-center gap-2 text-[12px] text-[#8b8074] transition-all duration-150",
        shouldHoverReveal
          ? collapseWhenHidden
            ? "mt-0 min-h-0 max-h-0 overflow-hidden opacity-0 pointer-events-none group-hover:min-h-7 group-hover:max-h-8 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:min-h-7 group-focus-within:max-h-8 group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
            : "mt-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
          : "mt-2 opacity-100",
        align === "right" ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      {formattedDate && (
        <span
          aria-label={formattedDate.fullLabel}
          className="cursor-default select-none whitespace-nowrap"
          title={formattedDate.fullLabel}
        >
          {formattedDate.shortLabel}
        </span>
      )}

      {children ? (
        <div className="flex shrink-0 items-center gap-0.5 transition-all duration-150">
          {children}
        </div>
      ) : null}
    </div>
  );
};