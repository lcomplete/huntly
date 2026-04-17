import moment from "moment";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";

type SmartMomentProps = {
  dt: string | Date | number;
  timeTypeLabel?: string;
}

const SmartMoment = ({dt, timeTypeLabel}: SmartMomentProps) => {
  const { i18n } = useTranslation();
  const momentLocale = i18n.language?.startsWith('zh') ? 'zh-cn' : 'en';
  const localized = moment(dt).locale(momentLocale);

  function getMoment() {
    let text = "";
    if (localized.isAfter(moment().add(-1, "d"))) {
      text = localized.fromNow(true);
    } else if (localized.isBefore(moment().startOf("year"))) {
      text = localized.format('ll');
    } else {
      text = localized.format('M-D HH:mm');
    }
    return text;
  }

  const tooltipText = timeTypeLabel
    ? `${timeTypeLabel}: ${localized.format('a h:mm ll')}`
    : localized.format('a h:mm ll');

  return (
    <Tooltip title={tooltipText} arrow>
      <span>
        {getMoment()}
      </span>
    </Tooltip>
  )
}

export default SmartMoment;