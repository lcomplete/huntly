import {CircularProgress} from "@mui/material";
import React from "react";

const Loading = () => {
  return <div className={'flex items-center flex-col'}><CircularProgress/></div>;
}

export default Loading;