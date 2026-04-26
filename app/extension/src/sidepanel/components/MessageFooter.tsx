import type { FC, ReactNode } from "react";
import { useI18n } from "../../i18n";

interface MessageFooterProps {
  align?: "left" | "right";
  actionsVisibility?: "always" | "hover";
  collapseWhenHidden?: boolean;
  createdAt?: string;
  children?: ReactNode;
}

function parseMessageDate(value?: string): Date | null {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type FooterDateLabels = {
  shortLabel: string;
  fullLabel: string;
};

function formatFooterDate(
  value: string | undefined,
  language: string
): FooterDateLabels | null {
  const parsed = parseMessageDate(value);
  if (!parsed) return null;

  const sameYear = parsed.getFullYear() === new Date().getFullYear();
  const shortDateFormat = new Intl.DateTimeFormat(language, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const shortDateWithYearFormat = new Intl.DateTimeFormat(language, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const fullDateTimeFormat = new Intl.DateTimeFormat(language, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return {
    shortLabel: sameYear
      ? shortDateFormat.format(parsed)
      : shortDateWithYearFormat.format(parsed),
    fullLabel: fullDateTimeFormat.format(parsed),
  };
}

export const MessageFooter: FC<MessageFooterProps> = ({
  align = "left",
  actionsVisibility = "always",
  collapseWhenHidden = false,
  createdAt,
  children,
}) => {
  const { language } = useI18n();
  const formattedDate = formatFooterDate(createdAt, language);
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