import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
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
      <div className={styles["markdown-body"]}>
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

      // 清除错误状态
      setProcessingError(null);
      setIsProcessing(false);

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

      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      chrome.runtime.sendMessage({
        type: "shortcuts_process",
        payload: {
          tabId: tab?.id,
          taskId: newTaskId,
          shortcutId: shortcut.id,
          shortcutName: shortcut.name,
          content: page.content,
          url: page.url,
          title: page.title,
        },
      });
    },
    [isProcessing, currentTaskId, page]
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
  const ShortcutMenu = useMemo(
    () => (
      <Box
        sx={{
          width: "100%",
          backgroundColor: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* 左侧区域：快捷指令菜单按钮 - 占50% */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            width: "50%",
            justifyContent: "flex-start",
            position: "relative",
          }}
        >
          {shortcuts.length > 0 && (
            <>
              <Button
                id="shortcut-menu-button"
                variant="outlined"
                size="small"
                startIcon={<SmartToyOutlinedIcon />}
                onClick={handleShortcutMenuOpen}
                aria-controls={shortcutMenuOpen ? "shortcut-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={shortcutMenuOpen ? "true" : undefined}
                sx={{
                  fontSize: "12px",
                  height: "32px",
                  textTransform: "none",
                  border: "2px solid transparent",
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #5a6fd8 0%, #6b4190 100%)",
                    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
                  },
                  "& .MuiButton-startIcon": {
                    color: "white",
                  },
                }}
              >
                Article AI Shortcuts
              </Button>

              <Menu
                id="shortcut-menu"
                anchorEl={shortcutMenuAnchor}
                open={shortcutMenuOpen}
                onClose={handleShortcutMenuClose}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "left",
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "left",
                }}
                PaperProps={{
                  sx: {
                    mt: 1,
                    minWidth: 200,
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                    borderRadius: "8px",
                  },
                }}
              >
                {shortcuts.map((shortcut) => (
                  <MenuItem
                    key={shortcut.id}
                    onClick={() => handleShortcutClick(shortcut)}
                    disabled={
                      isProcessing && currentShortcut?.id === shortcut.id
                    }
                    sx={{
                      fontSize: "14px",
                      minHeight: "36px",
                    }}
                  >
                    <SmartToyOutlinedIcon
                      sx={{ fontSize: "16px", marginRight: 1 }}
                    />
                    {shortcut.name}
                  </MenuItem>
                ))}
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

        {/* 右侧区域：快捷指令名称和加载指示器 - 占50% */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            width: "50%",
            justifyContent: "space-between",
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
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {currentShortcut.name}
              </Typography>
            )}
          </Box>

          {/* 右边：加载指示器 - 独立组件避免闪烁 */}
          <Box sx={{ display: "flex", alignItems: "center", paddingRight:2 }}>
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

        {/* 关闭按钮 */}
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{
            color: "#666",
            "&:hover": {
              backgroundColor: "rgba(0, 0, 0, 0.04)",
              color: "#333",
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    ),
    [
      shortcuts,
      shortcutMenuOpen,
      handleShortcutMenuOpen,
      handleShortcutMenuClose,
      handleShortcutClick,
      isProcessing,
      currentShortcut,
      processingError,
      handleClose,
    ]
  );

  return (
    <React.Fragment>
      {open && (
        <Modal
          isOpen={open}
          onRequestClose={handleClose}
          overlayClassName={styles.modalOverlay}
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
          <div className={styles.modalContent}>
            {/* 顶部快捷指令菜单 */}
            {ShortcutMenu}

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
                    <h1 style={{ marginBottom: "16px" }}>{page.title}</h1>
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
                    <StreamingContentRenderer currentTaskId={currentTaskId} />
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
