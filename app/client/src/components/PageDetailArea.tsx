import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArticleShortcutControllerApiFactory, PageControllerApiFactory, PageDetail} from "../api";
import Loading from "../components/Loading";
import {PageQueryKey} from "../domain/pageQueryKey";
import * as React from "react";
import {useEffect, useState} from "react";
import styles from "./PageDetail.module.css";
import CardMedia from "@mui/material/CardMedia";
import SmartMoment from "../components/SmartMoment";
import PageOperationButtons, {PageOperateEvent, PageOperation} from "../components/PageOperationButtons";
import {Box, CircularProgress, IconButton, Menu, MenuItem, Paper, Tooltip, Typography} from "@mui/material";
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import {setDocTitle} from "../common/docUtils";
import ScreenSearchDesktopOutlinedIcon from '@mui/icons-material/ScreenSearchDesktopOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import ScreenSearchDesktopRoundedIcon from '@mui/icons-material/ScreenSearchDesktopRounded';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ShortTextIcon from '@mui/icons-material/ShortText';

const PageDetailArea = ({
                           id,
                           onOperateSuccess
                         }: { id: number, onOperateSuccess?: (event: PageOperateEvent) => void }) => {
  const queryKey = [PageQueryKey.PageDetail, id];
  const queryClient = useQueryClient();
  const [isFullContent, setIsFullContent] = React.useState(false);
  const [isProcessingContent, setIsProcessingContent] = useState(false);
  const [processedContent, setProcessedContent] = useState<string>("");
  const [showProcessedSection, setShowProcessedSection] = useState(false);
  const [processedTitle, setProcessedTitle] = useState<string>("AI 处理结果");
  
  // AI操作菜单状态
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  
  // 获取可用的文章快捷指令
  const { data: shortcuts = [] } = useQuery(
    ["enabled-article-shortcuts"],
    async () => {
      const response = await ArticleShortcutControllerApiFactory().getEnabledShortcutsUsingGET();
      return response.data;
    },
    {
      staleTime: 5 * 60 * 1000, // 5分钟
    }
  );

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
    
    // 重置处理结果状态
    setShowProcessedSection(false);
    setProcessedContent("");
    setProcessedTitle("AI 处理结果");
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
  
  async function processWithShortcut(shortcutId: number, shortcutName: string) {
    if (isProcessingContent) return; // Prevent multiple requests
    
    setIsProcessingContent(true);
    setShowProcessedSection(true);
    setProcessedContent("");
    setProcessedTitle(shortcutName);
    try {
      const response = await PageControllerApiFactory().processWithShortcutUsingPOST(id, shortcutId);
      if (response && response.data && response.data.content) {
        setProcessedContent(response.data.content);
        // Only show processed section if content is not empty
        setShowProcessedSection(!!response.data.content);
      } else {
        // Hide if no content
        setShowProcessedSection(false);
      }
    } catch (error) {
      console.error(`Error processing with shortcut ${shortcutName}:`, error);
      setShowProcessedSection(false); // Hide section on error
    } finally {
      setIsProcessingContent(false);
    }
  }
  
  function updateContent(content) {
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
  
  // AI操作菜单处理函数
  const handleAIMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleAIMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleShortcutSelect = (shortcutId: number, shortcutName: string) => {
    processWithShortcut(shortcutId, shortcutName);
    handleAIMenuClose();
  };

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
                    
                    {shortcuts && shortcuts.length > 0 ? (
                      <>
                        <Tooltip title={'AI operations'} placement={"bottom"}>
                          <IconButton 
                            onClick={handleAIMenuClick}
                            aria-controls={openMenu ? 'ai-menu' : undefined}
                            aria-haspopup="true"
                            aria-expanded={openMenu ? 'true' : undefined}
                          >
                            <SmartToyOutlinedIcon fontSize={"small"} sx={{ color: "#6366F1" }} />
                            <KeyboardArrowDownIcon fontSize={"small"} />
                          </IconButton>
                        </Tooltip>
                        
                        <Menu
                          id="ai-menu"
                          anchorEl={anchorEl}
                          open={openMenu}
                          onClose={handleAIMenuClose}
                          MenuListProps={{
                            'aria-labelledby': 'ai-button',
                          }}
                        >
                          {shortcuts.map((shortcut) => (
                            <MenuItem 
                              key={shortcut.id} 
                              onClick={() => handleShortcutSelect(shortcut.id!, shortcut.name!)}
                              disabled={isProcessingContent}
                            >
                              <ShortTextIcon fontSize="small" className="mr-2" sx={{ color: "#8B5CF6" }} />
                              {shortcut.name}
                            </MenuItem>
                          ))}
                        </Menu>
                      </>
                    ) : null}
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
              
              {showProcessedSection && (
                <Paper elevation={0} className={"p-4 mb-5 bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-100 transition-all duration-300 rounded-lg"}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className="mr-2 bg-gradient-to-r from-blue-400 to-cyan-500 p-1.5 rounded-md text-white flex items-center justify-center">
                        <LightbulbOutlinedIcon fontSize="small" />
                      </div>
                      <Typography variant={"body2"} component={"div"} className={"font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-transparent bg-clip-text"}>
                        {processedTitle}
                      </Typography>
                    </div>
                    {isProcessingContent && (
                      <CircularProgress size={18} className="text-cyan-500" />
                    )}
                  </div>
                  <Typography variant={"body2"} component={"div"} className={"text-gray-600 leading-relaxed whitespace-pre-line"}>
                    {isProcessingContent && !processedContent ? (
                      <div className="flex flex-col space-y-2 h-12 animate-pulse">
                        <div className="h-2 bg-gradient-to-r from-blue-100 to-sky-100 rounded-full w-full opacity-70"></div>
                        <div className="h-2 bg-gradient-to-r from-sky-100 to-blue-100 rounded-full w-5/6 opacity-70"></div>
                        <div className="h-2 bg-gradient-to-r from-blue-100 to-sky-100 rounded-full w-4/6 opacity-70"></div>
                      </div>
                    ) : (
                      processedContent
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
