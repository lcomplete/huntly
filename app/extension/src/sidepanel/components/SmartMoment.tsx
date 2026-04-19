import type { FC } from "react";
import Tooltip from "@mui/material/Tooltip";
import moment from "moment";

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
  const value = moment(dt);
  if (!value.isValid()) return null;

  let text = "";
  if (value.isAfter(moment().add(-1, "d"))) {
    text = value.fromNow(true);
  } else if (value.isBefore(moment().startOf("year"))) {
    text = value.format("ll");
  } else {
    text = value.format("M-D HH:mm");
  }

  const tooltipText = timeTypeLabel
    ? `${timeTypeLabel}: ${value.format("a h:mm ll")}`
    : value.format("a h:mm ll");

  return (
    <Tooltip title={tooltipText} arrow>
      <span className={className}>{text}</span>
    </Tooltip>
  );
};
