import {safeInt} from "../common/typeUtils";
import {useParams} from "react-router-dom";
import MainContainer from "../components/MainContainer";
import * as React from "react";
import PageDetailArea from "../components/PageDetailArea";
import {PageOperation} from "../components/PageOperationButtons";
import {useSnackbar} from "notistack";
import SubHeader from "../components/SubHeader";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import {useQuery} from "@tanstack/react-query";
import {PageControllerApiFactory} from "../api";
import {PageQueryKey} from "../domain/pageQueryKey";

const Page = () => {
  const {id} = useParams<"id">();
  const {enqueueSnackbar} = useSnackbar();
  const pageId = safeInt(id);

  // Fetch page detail to get title
  const {data: detail} = useQuery(
    [PageQueryKey.PageDetail, pageId],
    async () => (await PageControllerApiFactory().getPageDetailByIdUsingGET(pageId)).data,
    {enabled: pageId > 0}
  );

  function operateSuccess(event) {
    if (event.operation === PageOperation.delete) {
      enqueueSnackbar('Page deleted.', {
        variant: "success",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    }
  }

  const articleNavLabel = {
    labelText: detail?.page?.title || 'Article',
    labelIcon: ArticleOutlinedIcon,
  };

  return (
    <MainContainer>
      <SubHeader
        navLabel={articleNavLabel}
        buttonOptions={{ markRead: false, viewSwitch: false }}
        hideSearchOnMobile={true}
      />
      <div className={'p-4 sm:p-4 max-sm:p-2'}>
        <PageDetailArea id={pageId} onOperateSuccess={operateSuccess}/>
      </div>
    </MainContainer>
  );
};

export default Page;