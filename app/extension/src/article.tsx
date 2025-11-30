import React, { useState, useEffect, useCallback, useRef } from "react";
import styles from "./article.module.css";
import Modal from "react-modal";
import {
  CircularProgress,
  Button,
  Divider,
  Typography,
  Chip,
  Box,
  IconButton,
  Fab,
  Menu,
  MenuItem,
} from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ShortTextIcon from "@mui/icons-material/ShortText";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { log } from "./logger";

// 定义快捷指令接口
interface Shortcut {
  id: number;
  name: string;
  description?: string;
  enabled: boolean;
}

// 独立的流式内容渲染组件 - 简化版本
const StreamingContentRenderer = ({
  currentTaskId,
}: {
  currentTaskId: string | null;
}) => {
  const [processedContent, setProcessedContent] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  // 内部消息监听
  useEffect(() => {
    setProcessedContent("");

    const messageListener = (msg: any, sender: any, sendResponse: any) => {
      // 只处理当前任务的消息
      if (!currentTaskId || msg.payload?.taskId !== currentTaskId) {
        return;
      }

      switch (msg.type) {
        case "shortcuts_process_data":
          setProcessedContent(msg.payload.accumulatedContent);
          break;
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [currentTaskId]);

  // 自动滚动到底部 - 只有当用户已经接近底部时才滚动
  useEffect(() => {
    if (processedContent && contentRef.current) {
      const scrollContainer = contentRef.current.closest(`.${styles.scrollContainer}`);
      if (scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const scrollThreshold = 100; // 距离底部100px内认为是接近底部
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - scrollThreshold;
        
        if (isNearBottom) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }
  }, [processedContent]);

  // 显示加载状态
  if (!processedContent) {
    return (
      <div className={styles.loadingPlaceholder}>
        {[100, 80, 60].map((width, index) => (
          <div
            key={index}
            className={styles.loadingBar}
            style={{ width: `${width}%` }}
          />
        ))}
      </div>
    );
  }

  // 显示内容
  if (processedContent) {
    return (
      <div ref={contentRef} className={styles["markdown-body"]}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {processedContent}
        </ReactMarkdown>
      </div>
    );
  }

  return <div style={{ minHeight: "20px" }} />;
};

export default function Article({
  page,
  shortcuts = [],
}: {
  page: PageModel;
  shortcuts?: Shortcut[];
}) {
  const [open, setOpen] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProcessedSection, setShowProcessedSection] = useState(false);
  const [currentShortcut, setCurrentShortcut] = useState<Shortcut | null>(null);
  const [shortcutMenuAnchor, setShortcutMenuAnchor] =
    useState<null | HTMLElement>(null);
  const shortcutMenuOpen = Boolean(shortcutMenuAnchor);

  const [processingError, setProcessingError] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  // 判断是否为 Snippet 模式
  const isSnippetMode = page.contentType === 4;

  const handleClose = useCallback(() => {
    document
      .getElementById("huntly_preview_unique_root")
      ?.removeAttribute("data-preview");
    // 发送取消处理的消息
    if (isProcessing && currentTaskId) {
      chrome.runtime.sendMessage({
        type: "shortcuts_cancel",
        payload: {
          taskId: currentTaskId,
        },
      });
    }
    setOpen(false);
  }, [isProcessing, currentTaskId]);

  const handleShortcutClick = useCallback(
    async (shortcut: Shortcut) => {
      // 如果正在处理，先停止当前任务
      if (isProcessing && currentTaskId) {
        chrome.runtime.sendMessage({
          type: "shortcuts_cancel",
          payload: {
            taskId: currentTaskId,
          },
        });
      }

      // 清除错误状态并开始处理
      setProcessingError(null);
      setIsProcessing(true);

      // 关闭菜单
      setShortcutMenuAnchor(null);

      // 生成新的 taskId
      const newTaskId = `task_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}`;
      setCurrentTaskId(newTaskId);

      // 设置当前快捷指令
      setCurrentShortcut(shortcut);
      setShowProcessedSection(true);

      // Snippet 模式下使用 description（纯文本），否则使用 content（HTML）
      const contentToProcess = isSnippetMode 
        ? (page.description || page.content)
        : page.content;
      
      chrome.runtime.sendMessage({
        type: "shortcuts_process",
        payload: {
          tabId: null, // background receive from sender
          taskId: newTaskId,
          shortcutId: shortcut.id,
          shortcutName: shortcut.name,
          content: contentToProcess,
          url: page.url,
          title: isSnippetMode ? '' : page.title,
          contentType: isSnippetMode ? 4 : undefined, // 4 = SNIPPET
          shortcuts: shortcuts,
        },
      });
    },
    [isProcessing, currentTaskId, page, shortcuts]
  );

  const handleShortcutMenuOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      setShortcutMenuAnchor(event.currentTarget);
    },
    []
  );

  const handleShortcutMenuClose = useCallback(() => {
    setShortcutMenuAnchor(null);
  }, []);

  // 添加点击外部关闭菜单的功能
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shortcutMenuOpen && shortcutMenuAnchor) {
        const menuElement = document.getElementById('shortcut-menu');
        const buttonElement = document.getElementById('shortcut-menu-button');
        
        if (menuElement && buttonElement && 
            !menuElement.contains(event.target as Node) && 
            !buttonElement.contains(event.target as Node)) {
          handleShortcutMenuClose();
        }
      }
    };

    if (shortcutMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [shortcutMenuOpen, shortcutMenuAnchor, handleShortcutMenuClose]);

  useEffect(() => {
    // 监听来自background的消息 - 只处理UI状态相关的消息
    const messageListener = (msg: any, sender: any, sendResponse: any) => {
      switch (msg.type) {
        case "shortcuts_processing_start":
          setCurrentTaskId(msg.payload?.taskId);
          setIsProcessing(true);
          setShowProcessedSection(true);
          setProcessingError(null);
          // 从消息中更新当前快捷指令
          if (msg.payload?.shortcutName) {
            const shortcut = shortcuts.find(
              (s) => s.name === msg.payload.shortcutName
            );
            if (shortcut) {
              setCurrentShortcut(shortcut);
            }
          }
          break;

        case "shortcuts_process_result":
        case "shortcuts_process_error":
          setIsProcessing(false);
          if (msg.type === "shortcuts_process_error") {
            setProcessingError(`处理失败: ${msg.payload.error}`);
          }
          break;
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      if (isProcessing && currentTaskId) {
        chrome.runtime.sendMessage({
          type: "shortcuts_cancel",
          payload: {
            taskId: currentTaskId,
          },
        });
      }
    };
  }, [currentTaskId, shortcuts, isProcessing]);

  // 自动清除错误提示
  useEffect(() => {
    if (processingError) {
      const timer = setTimeout(() => {
        setProcessingError(null);
      }, 5000); // 5秒后自动清除错误提示

      return () => clearTimeout(timer);
    }
  }, [processingError]);

  Modal.setAppElement("#huntly_preview_unique_root");

  // 快捷指令顶部菜单组件 - 使用 useMemo 优化
  const ShortcutMenu = () => (
    <Box
      sx={{
        backgroundColor: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "relative",
        zIndex: 10,
        overflow: "visible",
      }}
    >
      <svg width={0} height={0} style={{ position: 'absolute', visibility: 'hidden' }}>
        <linearGradient id="geminiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4facfe" />
          <stop offset="50%" stopColor="#a18cd1" />
          <stop offset="100%" stopColor="#fbc2eb" />
        </linearGradient>
      </svg>
      {/* 左侧区域：快捷指令菜单按钮 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flex: "1 1 0%",
          justifyContent: "flex-start",
          position: "static",
          minWidth: 0,
        }}
      >
        {/* 始终显示快捷指令按钮 */}
        {(
          <>
            <Button
              id="shortcut-menu-button"
              variant="outlined"
              size="small"
              startIcon={<AutoAwesomeIcon sx={{ fill: "url(#geminiGradient)" }} />}
              onClick={handleShortcutMenuOpen}
              aria-controls={shortcutMenuOpen ? "shortcut-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={shortcutMenuOpen ? "true" : undefined}
              disableRipple
              disableElevation
              sx={{
                fontSize: "12px",
                height: "32px",
                textTransform: "none",
                color: "#1976d2",
                borderColor: "rgba(25, 118, 210, 0.5)",
                background: "transparent",
                "&:hover": {
                  background: "rgba(25, 118, 210, 0.04)",
                  borderColor: "#1976d2",
                },
              }}
            >
              AI Shortcuts
            </Button>

            <Menu
              id="shortcut-menu"
              anchorEl={shortcutMenuAnchor}
              open={shortcutMenuOpen}
              onClose={handleShortcutMenuClose}
              disablePortal={true}
              PaperProps={{
                sx: {
                  mt: 4,
                  ml: 1,
                  minWidth: 200,
                  maxWidth: shortcuts.length > 0 ? 300 : 320,
                  width: "auto",
                  maxHeight: "400px",
                  overflowY: "auto",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  borderRadius: "8px",
                  zIndex: 100,
                  background: "linear-gradient(135deg, rgba(255, 255, 255) 0%, rgba(248, 250, 252) 100%)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(0, 0, 0, 0.1)",
                  color: "#374151",
                },
              }}
              MenuListProps={{
                sx: {
                  padding: "4px 0",
                  maxHeight: "400px",
                  overflowY: "auto",
                  width: "100%",
                },
              }}
              sx={{
                zIndex: 100,
              }}
            >
              {shortcuts.length > 0 ? (
                shortcuts.map((shortcut) => (
                  <MenuItem
                    key={shortcut.id}
                    onClick={() => handleShortcutClick(shortcut)}
                    disabled={isProcessing && currentShortcut?.id === shortcut.id}
                    sx={{
                      fontSize: "14px",
                      minHeight: "40px",
                      padding: "8px 16px",
                      whiteSpace: "nowrap",
                      overflow: "visible",
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                      color: "#374151",
                      transition: "all 0.2s ease-in-out",
                      "&:hover": {
                        backgroundColor: "rgba(102, 126, 234, 0.1)",
                        backdropFilter: "blur(6px)",
                        transform: "translateX(2px)",
                      },
                      "&:disabled": {
                        color: "rgba(55, 65, 81, 0.5)",
                        backgroundColor: "transparent",
                      },
                    }}
                  >
                    <ShortTextIcon 
                      fontSize="small" 
                      sx={{ 
                        marginRight: 1, 
                        color: "#6b7280",
                        transition: "color 0.2s ease-in-out",
                      }} 
                    />
                    {shortcut.name}
                  </MenuItem>
                ))
              ) : (
                <MenuItem
                  disabled
                  sx={{
                    fontSize: "14px",
                    padding: "12px 16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "100%",
                    maxWidth: "280px",
                    whiteSpace: "normal",
                    color: "#374151",
                    "&.Mui-disabled": {
                      opacity: 1,
                      color: "#374151",
                    },
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, marginBottom: 1, color: "#374151" }}>
                    快捷指令功能未配置
                  </Typography>
                  <Typography variant="caption" sx={{ lineHeight: 1.4, color: "#6b7280" }}>
                    请将 Huntly 服务端升级到最新版本，并在设置中配置 AI 快捷指令
                  </Typography>
                </MenuItem>
              )}
            </Menu>
          </>
        )}

        {/* 错误提示 - 移到区域底部 */}
        {processingError && (
          <Box
            sx={{
              position: "absolute",
              top: "100%",
              left: 0,
              mt: 1,
              display: "flex",
              alignItems: "center",
              gap: 1,
              backgroundColor: "#ffebee",
              color: "#c62828",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "12px",
              border: "1px solid #ffcdd2",
              zIndex: 1000,
              maxWidth: "300px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <ErrorOutlineIcon sx={{ fontSize: "14px" }} />
            {processingError}
          </Box>
        )}
      </Box>

      {/* 右侧区域：快捷指令名称和加载指示器 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flex: "1 1 0%",
          justifyContent: "space-between",
          minWidth: 0,
        }}
      >
        {/* 左边：快捷指令名称 */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {currentShortcut && (
            <Typography
              variant="h3"
              sx={{
                fontSize: "16px",
                fontWeight: 600,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                pl: 1
              }}
            >
              {currentShortcut.name}
            </Typography>
          )}
        </Box>

        {/* 右边：加载指示器 */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {isProcessing && (
            <CircularProgress
              size={18}
              sx={{
                // 使用 CSS 动画而非 JS 动画以获得更平滑的效果
                "& .MuiCircularProgress-circle": {
                  strokeLinecap: "round",
                },
              }}
            />
          )}
        </Box>
      </Box>

    </Box>
  );

  return (
    <React.Fragment>
      {open && (
        <Modal
          isOpen={open}
          onRequestClose={handleClose}
          overlayClassName={styles.modalOverlay}
          parentSelector={() => document.getElementById("huntly_preview_unique_root")!}
          style={{
            overlay: {
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(4px)",
            },
            content: {
              position: "absolute",
              top: "50%",
              left: "50%",
              right: "auto",
              bottom: "auto",
              transform: "translate(-50%, -50%)",
              width: showProcessedSection ? "95%" : "70%",
              maxWidth: showProcessedSection ? "1600px" : "900px",
              height: "95%",
              border: "none",
              background: "white",
              padding: 0,
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
            },
          }}
        >
          <div id="huntly-article-modal" className={styles.modalContent}>
            <ShortcutMenu />

            {/* 内容区域 */}
            <div className={styles.contentArea}>
              {/* 文章内容区域 */}
              <div
                className={styles.articleSection}
                style={{
                  width: showProcessedSection ? "50%" : "100%",
                }}
              >
                <div
                  className={styles.scrollContainer}
                  style={{ padding: "24px" }}
                >
                  <article className={styles["markdown-body"]}>
                    {!isSnippetMode && <h1 style={{ marginBottom: "16px" }}>{page.title}</h1>}
                    <div dangerouslySetInnerHTML={{ __html: page.content }} />
                  </article>
                </div>
              </div>

              {/* 处理结果区域 - 使用完全独立的组件 */}
              {showProcessedSection && (
                <div className={styles.processedSection}>
                  <div
                    className={styles.scrollContainer}
                    style={{ padding: "24px" }}
                  >
                    <StreamingContentRenderer 
                      key={currentTaskId} 
                      currentTaskId={currentTaskId} 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </React.Fragment>
  );
}
