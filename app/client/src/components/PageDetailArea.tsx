import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArticleShortcutControllerApiFactory, PageControllerApiFactory, PageDetail, PageHighlightControllerApiFactory, PageHighlightDto} from "../api";
import Loading from "../components/Loading";
import {PageQueryKey} from "../domain/pageQueryKey";
import * as React from "react";
import {useEffect, useState} from "react";
import {useLocation} from "react-router-dom";
import styles from "./PageDetail.module.css";
import "./PageDetailArea.css";
import CardMedia from "@mui/material/CardMedia";
import SmartMoment from "../components/SmartMoment";
import PageOperationButtons, {PageOperateEvent, PageOperation} from "../components/PageOperationButtons";
import {Box, Chip, CircularProgress, IconButton, Menu, MenuItem, Paper, Snackbar, Tooltip, Typography} from "@mui/material";
import { useSnackbar } from 'notistack';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import {setDocTitle} from "../common/docUtils";
import ScreenSearchDesktopOutlinedIcon from '@mui/icons-material/ScreenSearchDesktopOutlined';
import ScreenSearchDesktopRoundedIcon from '@mui/icons-material/ScreenSearchDesktopRounded';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ShortTextIcon from '@mui/icons-material/ShortText';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import PageHighlightList from './highlights/PageHighlightList';
import TextHighlighter from './highlights/TextHighlighter';
import TableOfContents, { getTocItems } from './TableOfContents';
import ListIcon from '@mui/icons-material/List';
import TextSnippetOutlinedIcon from '@mui/icons-material/TextSnippetOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

// 引入 TurndownService
import TurndownService from 'turndown';

const PageDetailArea = ({
                           id,
                           onOperateSuccess
                         }: { id: number, onOperateSuccess?: (event: PageOperateEvent) => void }) => {
  const queryKey = [PageQueryKey.PageDetail, id];
  const queryClient = useQueryClient();
  const location = useLocation();
  const [isFullContent, setIsFullContent] = React.useState(false);
  const [isProcessingContent, setIsProcessingContent] = useState(false);
  const [processedContent, setProcessedContent] = useState<string>("");
  const [showProcessedSection, setShowProcessedSection] = useState(false);
  const [processedTitle, setProcessedTitle] = useState<string>("AI Processing Result");
  const [processingError, setProcessingError] = useState<string>("");
  const { enqueueSnackbar } = useSnackbar();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [hasAutoScrolled, setHasAutoScrolled] = useState(false);
  const [highlightMode, setHighlightMode] = useState(true);
  const [showToc, setShowToc] = useState(true);
  
  // AI操作菜单状态
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  
  // 获取可用的文章快捷指令
  const { data: shortcuts = [] } = useQuery(
    ["enabled-article-shortcuts"],
    async () => {
      const response = await ArticleShortcutControllerApiFactory().getEnabledShortcutsUsingGET();
      return response.data;
    }
  );

  // 获取页面高亮
  const { data: highlights = [], refetch: refetchHighlights } = useQuery(
    [`page-highlights`, id],
    async () => {
      const response = await PageHighlightControllerApiFactory().getHighlightsByPageIdUsingGET(id);
      return response.data.data || [];
    },
    {
      enabled: !!id,
      onSuccess: (data) => {
        // 检查URL参数中是否有h参数，如果有且尚未自动滚动过则滚动到指定高亮
        const searchParams = new URLSearchParams(location.search);
        const highlightId = searchParams.get('h');
        if (highlightId && data && data.length > 0 && !hasAutoScrolled) {
          scrollToHighlightById(parseInt(highlightId));
          setHasAutoScrolled(true);
        }
      }
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

  const tocItems = React.useMemo(
    () => (detail?.page.content ? getTocItems(detail.page.content) : []),
    [detail?.page.content]
  );
  const hasToc = tocItems.length > 2;

  useEffect(() => {
    PageControllerApiFactory().recordReadPageUsingPOST(id);

    // 重置处理结果状态
    setShowProcessedSection(false);
    setProcessedContent("");
    setProcessedTitle("AI Processing Result");
    setProcessingError("");

    // 重置自动滚动状态
    setHasAutoScrolled(false);
  }, [id]);

  // 监听页面详情和高亮列表加载完成，如果URL中有h参数且尚未自动滚动过则滚动到指定高亮
  useEffect(() => {
    if (detail && highlights && highlights.length > 0 && !hasAutoScrolled) {
      const searchParams = new URLSearchParams(location.search);
      const highlightId = searchParams.get('h');
      if (highlightId) {
        // 延迟滚动以确保TextHighlighter组件已完全渲染
        setTimeout(() => {
          scrollToHighlightById(parseInt(highlightId));
          setHasAutoScrolled(true);
        }, 500);
      }
    }
  }, [detail, highlights, location.search, hasAutoScrolled]);

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
    setProcessingError(""); // 清除之前的错误状态
    
    try {
      // Use EventSource for SSE handling with fast mode
      const eventSource = new EventSource(`/api/page/processWithShortcut/${id}?shortcutId=${shortcutId}&mode=fast`);
      let hasReceivedData = false;
      
      eventSource.onmessage = (event) => {
        hasReceivedData = true;
        const data = event.data;
        
        try {
          // 尝试解析JSON格式的内容
          const parsedData = JSON.parse(data);
          // 如果是字符串，说明是fast模式下的文本内容
          if (typeof parsedData === 'string') {
            setProcessedContent(prev => prev + parsedData);
          } else {
            // 如果不是字符串，可能是其他格式的数据，直接使用
            setProcessedContent(prev => prev + data);
          }
        } catch (e) {
          // 解析JSON失败，说明不是JSON格式，直接使用原始数据
          setProcessedContent(prev => prev + data);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error(`SSE error for shortcut ${shortcutName}:`, error);
        
        // 只有在连接状态不是CLOSED且没有接收到数据时才认为是真正的错误
        if (eventSource.readyState !== EventSource.CLOSED && !hasReceivedData) {
          setProcessingError('Failed to connect to server, please try again later.');
        }
        
        setIsProcessingContent(false);
        eventSource.close();
      };
      
      // Handle named error events (服务端主动发送的错误事件)
      eventSource.addEventListener('error', (event) => {
        console.error('SSE named error event:', event);
        if ((event as any).data) {
          try {
            const errorData = JSON.parse((event as any).data);
            setProcessingError(`Processing failed: ${errorData.message || 'Unknown error'}`);
          } catch (e) {
            setProcessingError('Unknown error occurred during processing.');
          }
        }
        setIsProcessingContent(false);
        eventSource.close();
      });
      
      // Set a timeout to prevent hanging connections
      const timeout = setTimeout(() => {
        if (eventSource.readyState !== EventSource.CLOSED) {
          console.warn('SSE connection timeout');
          setIsProcessingContent(false);
          setProcessingError('Processing timeout, please try again later.');
          eventSource.close();
        }
      }, 300000); // 5 minutes timeout
      
      // Handle connection close (正常关闭)
      eventSource.addEventListener('close', () => {
        clearTimeout(timeout);
        setIsProcessingContent(false);
      });
      
    } catch (error) {
      console.error(`Error processing with shortcut ${shortcutName}:`, error);
      setIsProcessingContent(false);
      setProcessingError('Connection failed, please check your network connection.');
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

  // 导出Markdown功能
  const exportToMarkdown = () => {
    if (!detail) return;
    
    const title = detail.page.title || 'Untitled';
    const url = detail.page.url || '';
    
    // 直接使用 detail.page.content 获取内容
    const content = detail.page.content || '';
    
    // 使用 Turndown 将 HTML 转换为 Markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**',
    });
    
    // 添加表格支持
    turndownService.addRule('table', {
      filter: 'table',
      replacement: function(content) {
        return '\n' + content + '\n';
      }
    });
    
    // 转换 HTML 到 Markdown
    let markdownContent = turndownService.turndown(content);
    
    // 添加标题和链接
    markdownContent = `# ${title}\n\n[Original link](${url})\n\n${markdownContent}`;
    
    // 创建Blob对象
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title}.md`;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 复制 Markdown 文本功能
  const copyMarkdownToClipboard = () => {
    if (!detail) return;
    
    const title = detail.page.title || 'Untitled';
    const url = detail.page.url || '';
    
    // 直接使用 detail.page.content 获取内容
    const content = detail.page.content || '';
    
    // 使用 Turndown 将 HTML 转换为 Markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**',
    });
    
    // 添加表格支持
    turndownService.addRule('table', {
      filter: 'table',
      replacement: function(content) {
        return '\n' + content + '\n';
      }
    });
    
    // 转换 HTML 到 Markdown
    let markdownContent = turndownService.turndown(content);
    
    // 添加标题和链接
    markdownContent = `# ${title}\n\n[Original link](${url})\n\n${markdownContent}`;
    
    // 复制到剪贴板
    navigator.clipboard.writeText(markdownContent)
      .then(() => {
        enqueueSnackbar("Markdown content copied to clipboard", {
          variant: "success",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      })
      .catch(err => {
        enqueueSnackbar("Failed to copy, please copy manually", {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
        console.error('Failed to copy:', err);
      });
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // 高亮操作处理函数
  const handleHighlightCreated = (highlight: PageHighlightDto) => {
    refetchHighlights();
  };

  const handleHighlightDeleted = (highlightId: number) => {
    refetchHighlights();
    setSnackbarMessage("Highlight deleted successfully");
    setSnackbarOpen(true);
  };

  const scrollToHighlightById = (highlightId: number) => {
    // 查找对应的高亮元素并滚动到该位置
    const highlightElement = document.querySelector(`[data-highlight-id="${highlightId}"]`);
    if (highlightElement) {
      // 延迟滚动以确保DOM元素已完全渲染
      setTimeout(() => {
        highlightElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        // 添加闪烁效果
        highlightElement.classList.add('highlight-flash');
        setTimeout(() => {
          highlightElement.classList.remove('highlight-flash');
        }, 2000);
      }, 100);
    }
  };

  const handleHighlightClick = (highlight: PageHighlightDto) => {
    if (highlight.id) {
      scrollToHighlightById(highlight.id);
      setSnackbarMessage(`Jump to highlight: "${highlight.highlightedText?.substring(0, 20)}..."`);
      setSnackbarOpen(true);
    } else {
      setSnackbarMessage("Unable to locate this highlight position");
      setSnackbarOpen(true);
    }
  };

  return (
    <div className="page-detail-layout">
      {isLoading && <Loading/>}
      {error && <p>error...</p>}
      {detail && (
        <div className="page-detail-content-wrapper">
          {/* 左侧占位区域 - 仅在目录存在时保留空间 */}
          {hasToc && <div className="page-detail-spacer hidden xl:block"></div>}
          
          {/* 主内容区域 */}
          <Paper
            className={"page-detail-paper"}
            sx={{maxWidth: 800, minWidth: 800}}
            key={detail.page.id}
            elevation={2}
          >
            <div
              className={'page-detail-header bg-sky-50 pl-2 pr-2 pt-1.5 pb-1.5 mb-4 border-0 border-solid border-b-[2px] border-b-blue-100 sticky top-0 backdrop-blur-2xl bg-opacity-60 z-40'}>
              {/* Tool buttons on left, page operations on right */}
              <Box className={"flex items-center justify-between"}>
                {/* Left side: Tool buttons */}
                <div className={'page-detail-tools flex items-center gap-0.5'}>
                  <Tooltip title={'Load full content'} placement={"bottom"}>
                    {
                      isFullContent ? <IconButton size="small" onClick={switchRawContent}>
                        <ScreenSearchDesktopRoundedIcon fontSize={"small"}/>
                      </IconButton> : <IconButton size="small" onClick={loadFullContent}>
                        <ScreenSearchDesktopOutlinedIcon fontSize={"small"}/>
                      </IconButton>
                    }
                  </Tooltip>

                  <Tooltip title={'Export to Markdown'} placement={"bottom"}>
                    <IconButton size="small" onClick={exportToMarkdown}>
                      <SaveAltIcon fontSize={"small"} />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title={'Copy Markdown content'} placement={"bottom"}>
                    <IconButton size="small" onClick={copyMarkdownToClipboard}>
                      <ContentCopyIcon fontSize={"small"} />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title={highlightMode ? 'Disable text highlighting selection tool' : 'Enable text highlighting selection tool'} placement={"bottom"}>
                    <IconButton size="small" onClick={() => setHighlightMode(!highlightMode)}>
                      <FormatQuoteIcon fontSize={"small"} sx={{ color: highlightMode ? "#f59e0b" : "#9e9e9e" }} />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title={showToc ? 'Hide outline' : 'Show outline'} placement={"bottom"}>
                    <IconButton size="small" onClick={() => setShowToc(!showToc)}>
                      <ListIcon fontSize={"small"} sx={{ color: showToc ? "#3b82f6" : "#9e9e9e" }} />
                    </IconButton>
                  </Tooltip>

                  {shortcuts && shortcuts.length > 0 ? (
                    <>
                      <svg width={0} height={0}>
                        <linearGradient id="geminiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#4facfe" />
                          <stop offset="50%" stopColor="#a18cd1" />
                          <stop offset="100%" stopColor="#fbc2eb" />
                        </linearGradient>
                      </svg>
                      <Tooltip title={'AI operations'} placement={"bottom"}>
                        <IconButton
                          size="small"
                          onClick={handleAIMenuClick}
                          aria-controls={openMenu ? 'ai-menu' : undefined}
                          aria-haspopup="true"
                          aria-expanded={openMenu ? 'true' : undefined}
                        >
                          <AutoAwesomeIcon fontSize={"small"} sx={{ fill: "url(#geminiGradient)" }} />
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
                </div>

                {/* Right side: Page operation buttons */}
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
              <Typography variant={"h1"} sx={{marginBottom: 1}}>
                <a href={detail.page.url} target={"_blank"} rel="noreferrer" className={'!text-inherit'}>
                  {detail.page.title}
                </a>
                {detail.page.contentType === 4 && (
                  <Chip
                    icon={<TextSnippetOutlinedIcon style={{fontSize: 16}} />}
                    label="Snippet"
                    size="small"
                    variant="outlined"
                    sx={{
                      ml: 2,
                      verticalAlign: 'middle',
                      height: 22,
                      fontSize: '12px',
                      color: 'text.secondary',
                      borderColor: 'rgba(0, 0, 0, 0.12)',
                      bgcolor: '#f9fafb',
                      '& .MuiChip-label': {
                        px: 0.8,
                        pb: 0.1
                      }
                    }}
                  />
                )}
              </Typography>

              {/* Site info and time - moved below title */}
              <div className={'flex items-center gap-2 mb-4 text-sm text-slate-500'}>
                <a href={detail.page.url} target={"_blank"} rel="noreferrer" className={'hover:text-slate-700 transition-colors flex items-center gap-1.5'}>
                  {iconUrl && (
                    <CardMedia component={'img'} image={iconUrl}
                               sx={{ width: 14, height: 14, borderRadius: '2px' }}/>
                  )}
                  <span className={'hover:underline'}>{siteName}</span>
                </a>
                <span className={'text-slate-300'}>•</span>
                <span className={'text-slate-400'}>
                  <SmartMoment dt={detail.page.connectorId ? detail.page.connectedAt : detail.page.createdAt} />
                </span>
              </div>

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
                  
                  {/* 错误提示区域 */}
                  {processingError && (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center">
                        <div className="mr-2 bg-red-500 p-1 rounded-full text-white flex items-center justify-center w-5 h-5">
                          <span className="text-xs">!</span>
                        </div>
                        <Typography variant={"body2"} className="text-red-700">
                          {processingError}
                        </Typography>
                      </div>
                    </div>
                  )}
                  
                  <Typography variant={"body2"} component={"div"} className={"markdown-content"}>
                    {isProcessingContent && !processedContent && !processingError ? (
                      <div className="flex flex-col space-y-2 h-12 animate-pulse">
                        <div className="h-2 bg-gradient-to-r from-blue-100 to-sky-100 rounded-full w-full opacity-70"></div>
                        <div className="h-2 bg-gradient-to-r from-sky-100 to-blue-100 rounded-full w-5/6 opacity-70"></div>
                        <div className="h-2 bg-gradient-to-r from-blue-100 to-sky-100 rounded-full w-4/6 opacity-70"></div>
                      </div>
                    ) : processedContent ? (
                      <div className={`prose prose-sm max-w-none`}>
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({node, inline, className, children, ...props}) {
                              return (
                                <code className={`${className} bg-gray-100 rounded px-1`} {...props}>
                                  {children}
                                </code>
                              )
                            },
                            pre({node, children, ...props}) {
                              return (
                                <pre className="bg-gray-100 rounded p-2 overflow-auto" {...props}>
                                  {children}
                                </pre>
                              )
                            },
                            table({node, children, ...props}) {
                              return (
                                <div className="overflow-auto">
                                  <table className="border-collapse border border-gray-300" {...props}>
                                    {children}
                                  </table>
                                </div>
                              )
                            },
                            th({node, children, ...props}) {
                              return (
                                <th className="border border-gray-300 px-4 py-2 bg-gray-100" {...props}>
                                  {children}
                                </th>
                              )
                            },
                            td({node, children, ...props}) {
                              return (
                                <td className="border border-gray-300 px-4 py-2" {...props}>
                                  {children}
                                </td>
                              )
                            }
                          }}
                        >
                          {processedContent}
                        </ReactMarkdown>
                      </div>
                    ) : null}
                  </Typography>
                </Paper>
              )}

              {/* 高亮列表组件 */}
              <PageHighlightList
                highlights={highlights}
                onHighlightClick={handleHighlightClick}
                onHighlightDeleted={refetchHighlights}
              />
              
              {/* 使用高亮文本组件替代原来的HTML内容渲染 */}
              <Typography variant={"body1"} component={'div'} className="page-content">
                <TextHighlighter
                  pageId={detail.page.id || 0}
                  content={detail.page.content || ''}
                  highlights={highlights}
                  onHighlightCreated={handleHighlightCreated}
                  onHighlightDeleted={handleHighlightDeleted}
                  showSuccessMessage={(message) => {
                    enqueueSnackbar(message, {
                      variant: "success",
                      anchorOrigin: { vertical: "bottom", horizontal: "center" }
                    });
                  }}
                  showErrorMessage={(message) => {
                    enqueueSnackbar(message, {
                      variant: "error",
                      anchorOrigin: { vertical: "bottom", horizontal: "center" }
                    });
                  }}
                  highlightModeEnabled={highlightMode}
                />
              </Typography>
            </article>
          </div>
        </Paper>
        
        {/* 目录区域 - 显示在内容右侧，使用 visibility 而不是 display 保持占位 */}
        {hasToc && (
          <div className={`page-detail-toc-area hidden xl:block ${showToc ? '' : 'invisible'}`}>
            {detail.page.content && (
              <TableOfContents content={detail.page.content} />
            )}
          </div>
        )}
        </div>
      )}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
    </div>
  );
};

export default PageDetailArea;
