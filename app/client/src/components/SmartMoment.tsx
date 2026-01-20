import moment from "moment";
import Tooltip from "@mui/material/Tooltip";

type SmartMomentProps = {
  dt: string | Date | number;
  timeTypeLabel?: string;
}

const SmartMoment = ({dt, timeTypeLabel}: SmartMomentProps) => {
  function getMoment() {
    let text = "";
    if (moment(dt).isAfter(moment().add(-1, "d"))) {
      text = moment(dt).fromNow(true);
    } else if (moment(dt).isBefore(moment().startOf("year"))) {
      text = moment(dt).format('ll');
    } else {
      text = moment(dt).format('M-D HH:mm');
    }
    return text;
  }

  const tooltipText = timeTypeLabel
    ? `${timeTypeLabel}: ${moment(dt).format('a h:mm ll')}`
    : moment(dt).format('a h:mm ll');

  return (
    <Tooltip title={tooltipText} arrow>
      <span>
        {getMoment()}
      </span>
    </Tooltip>
  )
}

export default SmartMoment;