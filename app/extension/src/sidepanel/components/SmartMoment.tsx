import type { FC } from "react";
import Tooltip from "@mui/material/Tooltip";
import { useI18n } from "../../i18n";

type SmartMomentProps = {
  dt: string | Date | number;
  timeTypeLabel?: string;
  className?: string;
};

export const SmartMoment: FC<SmartMomentProps> = ({
  dt,
  timeTypeLabel,
  className,
}) => {
  const { language } = useI18n();
  const value = new Date(dt);
  if (Number.isNaN(value.getTime())) return null;

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - value.getTime());
  const oneDayMs = 24 * 60 * 60 * 1000;
  const currentYear = now.getFullYear();
  const isZh = language === "zh-CN";

  const formatRelative = () => {
    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    if (diffMinutes < 1) {
      return isZh ? "刚刚" : "just now";
    }

    if (diffMinutes < 60) {
      return isZh ? `${diffMinutes} 分钟` : `${diffMinutes} min`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    return isZh
      ? `${diffHours} 小时`
      : `${diffHours} hr${diffHours === 1 ? "" : "s"}`;
  };

  let text = "";
  if (diffMs < oneDayMs) {
    text = formatRelative();
  } else if (value.getFullYear() < currentYear) {
    text = new Intl.DateTimeFormat(language, {
      dateStyle: "medium",
    }).format(value);
  } else {
    text = new Intl.DateTimeFormat(language, {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: !isZh,
    }).format(value);
  }

  const formattedTooltip = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
  const tooltipText = timeTypeLabel
    ? `${timeTypeLabel}: ${formattedTooltip}`
    : formattedTooltip;

  return (
    <Tooltip title={tooltipText} arrow>
      <span className={className}>{text}</span>
    </Tooltip>
  );
};
