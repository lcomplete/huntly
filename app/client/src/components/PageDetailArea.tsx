import Typography from "@mui/material/Typography";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {PageControllerApiFactory, PageDetail} from "../api";
import Loading from "../components/Loading";
import {PageQueryKey} from "../domain/pageQueryKey";
import * as React from "react";
import {useEffect} from "react";
import styles from "./PageDetail.module.css";
import CardMedia from "@mui/material/CardMedia";
import SmartMoment from "../components/SmartMoment";
import PageOperationButtons, {PageOperateEvent, PageOperation} from "../components/PageOperationButtons";
import {Box, Paper} from "@mui/material";
import {setDocTitle} from "../common/docUtils";

const PageDetailArea = ({
                          id,
                          onOperateSuccess
                        }: { id: number, onOperateSuccess?: (event: PageOperateEvent) => void }) => {
  const queryKey = [PageQueryKey.PageDetail, id];
  const queryClient = useQueryClient();
  const {
    isLoading,
    error,
    data: detail
  } = useQuery(queryKey, async () => (await PageControllerApiFactory().getPageDetailByIdUsingGET(id)).data);

  if (detail) {
    setDocTitle(detail.page.title);
  }
  
  let iconUrl = "";
  let siteName = "";
  if (detail && detail.connector) {
    iconUrl = detail.connector.iconUrl;
    siteName = detail.connector.name;
  }
  if(!iconUrl && detail && detail.source){
    iconUrl = detail.source.faviconUrl;
  }
  if(!siteName && detail && detail.source){
    siteName = detail.source.siteName;
  }

  useEffect(() => {
    PageControllerApiFactory().recordReadPageUsingPOST(id);
  }, []);

  function operateSuccess(event: PageOperateEvent) {
    if (event.operation !== PageOperation.delete) {
      queryClient.setQueryData<PageDetail>(queryKey, (data) => ({
        ...data,
        page: {
          ...data.page,
          starred: event.result.starred,
          readLater: event.result.readLater,
          librarySaveStatus: event.result.librarySaveStatus,
        }
      }));
    }
    if (onOperateSuccess) {
      onOperateSuccess(event);
    }
  }

  return (
    <div className="pl-2 pr-2 flex flex-col items-center">
      {isLoading && <Loading/>}
      {error && <p>error...</p>}
      {detail && (
        <Paper
          sx={{maxWidth: 800, minWidth: 800}}
          key={detail.page.id}
          elevation={2}
        >
          <div className={'bg-sky-50 pl-2 pr-2 pt-1 pb-1 mb-4 border-0 border-solid border-b-[2px] border-b-blue-100 sticky top-0 backdrop-blur-2xl bg-opacity-60 z-40'}>
            <Box sx={{}} className={"flex items-center justify-between"}>
              <a href={detail.page.url} target={"_blank"} className={'hover:underline'}>
                <div className={"flex items-center"}>
                  { iconUrl &&
                    <span className={"mr-2"}>
                        <CardMedia component={'img'} image={iconUrl}
                                   sx={{
                                     width: 16, height: 16
                                   }}/>
                      </span>
                  }
                  <Typography variant={"body2"} color={"text.secondary"} component={"span"}
                              className={'flex'}>
                       <span
                         className={"max-w-[260px] text-ellipsis break-all whitespace-nowrap overflow-hidden"}>
                         {siteName}
                       </span>
                    <span className={"mr-1 ml-1"}>·</span>
                    <SmartMoment
                      dt={detail.page.connectorId ? detail.page.connectedAt : detail.page.createdAt}></SmartMoment>
                  </Typography>
                </div>
              </a>

              <PageOperationButtons pageStatus={{
                id: detail.page.id,
                starred: detail.page.starred,
                readLater: detail.page.readLater,
                librarySaveStatus: detail.page.librarySaveStatus
              }} onOperateSuccess={operateSuccess}/>
            </Box>
          </div>
          
          <div className={'pl-4 pr-4 mb-4'}>
            <article className={styles["markdown-body"]}>
              <Typography variant={"h1"} sx={{marginBottom: 2}}>
                <a href={detail.page.url} target={"_blank"} className={'!text-inherit'}>
                  {detail.page.title}
                </a>
              </Typography>

              <Typography variant={"body1"} component={'div'}>
                <div dangerouslySetInnerHTML={{__html: detail.page.content}}></div>
              </Typography>
            </article>
          </div>
        </Paper>
      )}
    </div>
  );
};

export default PageDetailArea;
