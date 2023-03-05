import {safeInt} from "../common/typeUtils";
import {useParams} from "react-router-dom";
import MainContainer from "../components/MainContainer";
import * as React from "react";
import PageDetailArea from "../components/PageDetailArea";
import {PageOperation} from "../components/PageOperationButtons";
import {useSnackbar} from "notistack";

const Page = () => {
  const {id} = useParams<"id">();
  const {enqueueSnackbar} = useSnackbar();

  function operateSuccess(event) {
    if (event.operation === PageOperation.delete) {
      enqueueSnackbar('Page deleted.', {
        variant: "success",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    }
  }

  return (
    <MainContainer>
      <div className={'p-4'}>
        <PageDetailArea id={safeInt(id)} onOperateSuccess={operateSuccess}/>
      </div>
    </MainContainer>
  );
};

export default Page;