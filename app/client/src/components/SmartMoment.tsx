import moment from "moment";

const SmartMoment = ({dt}) => {
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

  return (
    <span title={moment(dt).format('a h:mm ll')}>
      {getMoment()}
    </span>
  )
}

export default SmartMoment;