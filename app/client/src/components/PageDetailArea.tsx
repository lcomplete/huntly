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
import {Box, CircularProgress, IconButton, Paper, Tooltip, Typography} from "@mui/material";
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import {setDocTitle} from "../common/docUtils";
import ScreenSearchDesktopOutlinedIcon from '@mui/icons-material/ScreenSearchDesktopOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import ScreenSearchDesktopRoundedIcon from '@mui/icons-material/ScreenSearchDesktopRounded';

const PageDetailArea = ({
                           id,
                           onOperateSuccess
                         }: { id: number, onOperateSuccess?: (event: PageOperateEvent) => void }) => {
  const queryKey = [PageQueryKey.PageDetail, id];
  const queryClient = useQueryClient();
  const [isFullContent, setIsFullContent] = React.useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<string>("");
  const [showSummarySection, setShowSummarySection] = React.useState(false);

  const {
    isLoading,
    error,
    data: detail
  } = useQuery(queryKey, async () => (await PageControllerApiFactory().getPageDetailByIdUsingGET(id)).data, {
    onSuccess: (data) => {
      if (data && data.page) {
        setDocTitle(data.page.title);
        if (data.pageContents) {
          const rawContent = data.pageContents.find((content) => content.articleContentCategory === 0);
          setIsFullContent(rawContent != null);
          const summaryContent = data.pageContents.find((content) => content.articleContentCategory === 1);
          if (summaryContent) {
            setSummary(summaryContent.content);
            setShowSummarySection(true);
          }
        }
      }
    }
  });

  let iconUrl = "";
  let siteName = "";
  if (detail && detail.connector) {
    iconUrl = detail.connector.iconUrl;
    siteName = detail.connector.name;
  }
  if (!iconUrl && detail && detail.source) {
    iconUrl = detail.source.faviconUrl;
  }
  if (!siteName && detail && detail.source) {
    siteName = detail.source.siteName;
  }

  useEffect(() => {
    PageControllerApiFactory().recordReadPageUsingPOST(id);
  }, [id]);

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

  async function loadFullContent() {
    const fullContent = await PageControllerApiFactory().fetchFullContentByIdUsingPOST(id);
    if (fullContent && fullContent.data) {
      updateContent(fullContent.data.content);
      setIsFullContent(true);
    }
  }
  
  async function generateSummary() {
    if (isSummaryLoading) return; // Prevent multiple requests
    
    setIsSummaryLoading(true);
    setShowSummarySection(true);
    try {
      const summaryResponse = await PageControllerApiFactory().generateSummaryByIdUsingPOST(id);
      if (summaryResponse && summaryResponse.data && summaryResponse.data.content) {
        setSummary(summaryResponse.data.content);
        // Only show summary section if content is not empty
        setShowSummarySection(!!summaryResponse.data.content);
      } else {
        // Hide if no content
        setShowSummarySection(false);
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      setShowSummarySection(false); // Hide section on error
    } finally {
      setIsSummaryLoading(false);
    }
  }
  
  function updateContent(content){
    queryClient.setQueryData<PageDetail>(queryKey, (data) => {
      return {
        ...data,
        page: {
          ...data.page,
          content: content
        }
      };
    });
  }

  async function switchRawContent() {
    const rawContent = await PageControllerApiFactory().switchRawContentByIdUsingPOST(id);
    if (rawContent && rawContent.data) {
      updateContent(rawContent.data.content);
      setIsFullContent(false);
    }
  }

  return (
    <div className="pl-2 pr-2 flex flex-col items-center">
      {isLoading && <Loading/>}
      {error && <p>error...</p>}
      {detail && (
        <Paper
          className={"page-detail-paper"}
          sx={{maxWidth: 800, minWidth: 800}}
          key={detail.page.id}
          elevation={2}
        >
          <div
            className={'bg-sky-50 pl-2 pr-2 pt-1 pb-1 mb-4 border-0 border-solid border-b-[2px] border-b-blue-100 sticky top-0 backdrop-blur-2xl bg-opacity-60 z-40'}>
            <Box sx={{}} className={"flex items-center justify-between"}>
              <div className={'flex items-center'}>
                <a href={detail.page.url} target={"_blank"} rel="noreferrer" className={'hover:underline'}>
                  <div className={"flex items-center"}>
                    {iconUrl &&
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

                <span className={'ml-2'}>
                    <Tooltip title={'Load full content'} placement={"bottom"}>
                      {
                        isFullContent ? <IconButton onClick={switchRawContent}>
                          <ScreenSearchDesktopRoundedIcon fontSize={"small"}/>
                        </IconButton> : <IconButton onClick={loadFullContent}>
                          <ScreenSearchDesktopOutlinedIcon fontSize={"small"}/>
                        </IconButton>
                      }
                    </Tooltip>
                    <Tooltip title={'AI generate summary'} placement={"bottom"}>
                      <IconButton onClick={generateSummary} disabled={isSummaryLoading}>
                        <SmartToyOutlinedIcon fontSize={"small"} />
                      </IconButton>
                    </Tooltip>
                  </span>
              </div>

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
                <a href={detail.page.url} target={"_blank"} rel="noreferrer" className={'!text-inherit'}>
                  {detail.page.title}
                </a>
              </Typography>
              
              {showSummarySection && (
                <Paper elevation={0} className={"p-4 mb-5 bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-100 transition-all duration-300 rounded-lg"}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className="mr-2 bg-gradient-to-r from-blue-400 to-cyan-500 p-1.5 rounded-md text-white flex items-center justify-center">
                        <LightbulbOutlinedIcon fontSize="small" />
                      </div>
                      <Typography variant={"body2"} component={"div"} className={"font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-transparent bg-clip-text"}>
                        AI 摘要
                      </Typography>
                    </div>
                    {isSummaryLoading && (
                      <CircularProgress size={18} className="text-cyan-500" />
                    )}
                  </div>
                  <Typography variant={"body2"} component={"div"} className={"text-gray-600 leading-relaxed"}>
                    {isSummaryLoading && !summary ? (
                      <div className="flex flex-col space-y-2 h-12 animate-pulse">
                        <div className="h-2 bg-gradient-to-r from-blue-100 to-sky-100 rounded-full w-full opacity-70"></div>
                        <div className="h-2 bg-gradient-to-r from-sky-100 to-blue-100 rounded-full w-5/6 opacity-70"></div>
                        <div className="h-2 bg-gradient-to-r from-blue-100 to-sky-100 rounded-full w-4/6 opacity-70"></div>
                      </div>
                    ) : (
                      summary
                    )}
                  </Typography>
                </Paper>
              )}
              
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
