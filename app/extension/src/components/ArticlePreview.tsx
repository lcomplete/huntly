import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TurndownService from "turndown";
import {
  ContentParserType,
  readSyncStorageSettings,
  getThinkingModeEnabled,
  saveThinkingModeEnabled,
} from "../storage";
import { PageOperateResult } from "../model/pageOperateResult";
import { parseDocument } from "../parser/contentParser";
import AIToolbar, {
  ShortcutItem,
  ModelItem,
  AIGradientDef,
  ExternalShortcutsData,
  ExternalModelsData,
} from "./AIToolbar";
import SaveDetailPanel from "./SaveDetailPanel";
import { useShadowContainer } from "./shadowContainerContext";
import ExportButton from "./ExportButton";

// Create turndown instance for HTML to markdown conversion
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// Helper function to convert HTML to markdown
function htmlToMarkdown(html: string): string {
  if (!html) return "";
  try {
    return turndownService.turndown(html);
  } catch (error) {
    console.error("Failed to convert HTML to markdown:", error);
    return html; // Fallback to original HTML if conversion fails
  }
}

interface ArticlePreviewProps {
  page: PageModel;
  initialParserType: ContentParserType;
  onClose: () => void;
  onParserChange?: (parserType: ContentParserType, newPage: PageModel) => void;
  /** Externally provided shortcuts data (for content script use) */
  externalShortcuts?: ExternalShortcutsData;
  /** Externally provided models data (for content script use) */
  externalModels?: ExternalModelsData;
  /** Shortcut to auto-execute on mount */
  autoExecuteShortcut?: ShortcutItem;
  /** Model to use for auto-execute */
  autoSelectedModel?: ModelItem | null;
  /** Initial thinking mode from popup-triggered preview */
  initialThinkingModeEnabled?: boolean;
}

// Ref handle for StreamingContentRenderer
export interface StreamingContentRendererHandle {
  getProcessedMarkdown: () => string;
  getContentElement: () => HTMLDivElement | null;
}

// Streaming content renderer component
const StreamingContentRenderer = forwardRef<
  StreamingContentRendererHandle,
  { currentTaskId: string | null }
>(({ currentTaskId }, ref) => {
  const [processedContent, setProcessedContent] = useState("");
  const [reasoningContent, setReasoningContent] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    getProcessedMarkdown: () => processedContent,
    getContentElement: () => contentRef.current,
  }));

  useEffect(() => {
    setProcessedContent("");
    setReasoningContent("");
    setIsThinking(false);
    const messageListener = (msg: any) => {
      if (!currentTaskId || msg.payload?.taskId !== currentTaskId) return;
      if (msg.type === "shortcuts_process_data") {
        setProcessedContent(
          msg.payload.answerContent ?? msg.payload.accumulatedContent ?? ""
        );
        setReasoningContent(msg.payload.reasoningContent ?? "");
        setIsThinking(Boolean(msg.payload.isThinking));
      }
      if (msg.type === "shortcuts_process_result") {
        setProcessedContent(msg.payload.content ?? "");
        setReasoningContent(msg.payload.reasoningContent ?? "");
        setIsThinking(Boolean(msg.payload.isThinking));
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, [currentTaskId]);

  const hasProcessedContent = Boolean(processedContent.trim());
  const hasReasoningContent = Boolean(reasoningContent.trim());

  if (!hasProcessedContent && !hasReasoningContent) {
    return (
      <div className="huntly-loading-placeholder">
        {[100, 80, 60].map((width) => (
          <div
            key={`loading-${width}`}
            className="huntly-loading-bar"
            style={{ width: `${width}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div ref={contentRef}>
      {(hasReasoningContent || isThinking) && (
        <details
          className="huntly-thinking-panel"
          key={currentTaskId || "thinking-panel"}
        >
          <summary className="huntly-thinking-summary">
            <div className="huntly-thinking-summary-content">
              <div className="huntly-thinking-status-row">
                {isThinking && (
                  <span
                    className="huntly-thinking-spinner"
                    aria-hidden="true"
                  />
                )}
                <span className="huntly-thinking-title">
                  {isThinking ? "Thinking" : "Thought process"}
                </span>
              </div>
              <span className="huntly-thinking-chevron" aria-hidden="true">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </span>
            </div>
          </summary>
          <div
            className="huntly-thinking-body"
            aria-live={isThinking ? "polite" : "off"}
          >
            {hasReasoningContent ? (
              <div className="huntly-markdown-body huntly-thinking-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {reasoningContent}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="huntly-thinking-empty">
                The model is still thinking...
              </div>
            )}
          </div>
        </details>
      )}

      {hasProcessedContent ? (
        <div className="huntly-markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {processedContent}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="huntly-loading-placeholder">
          {[100, 80, 60].map((width) => (
            <div
              key={`answer-loading-${width}`}
              className="huntly-loading-bar"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// Close icon SVG
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

export const ArticlePreview: React.FC<ArticlePreviewProps> = ({
  page: initialPage,
  initialParserType,
  onClose,
  onParserChange,
  externalShortcuts,
  externalModels,
  autoExecuteShortcut,
  autoSelectedModel,
  initialThinkingModeEnabled = false,
}) => {
  const [page, setPage] = useState<PageModel>(initialPage);
  const [parserType, setParserType] =
    useState<ContentParserType>(initialParserType);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProcessedSection, setShowProcessedSection] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    pageId: number;
    page: PageModel;
    operateResult: PageOperateResult;
    collectionTree?: any;
  } | null>(null);
  const [serverConfigured, setServerConfigured] = useState(false);
  const [thinkingModeEnabled, setThinkingModeEnabled] = useState(
    initialThinkingModeEnabled ?? false
  );

  // Refs for export functionality
  const originalContentRef = useRef<HTMLDivElement>(null);
  const streamingRendererRef = useRef<StreamingContentRendererHandle>(null);

  useEffect(() => {
    const articleElement = originalContentRef.current;
    if (!articleElement) {
      return;
    }

    articleElement.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) {
        return;
      }

      try {
        const resolvedUrl = new URL(href, page.url);
        if (resolvedUrl.protocol === "javascript:" || resolvedUrl.protocol === "data:") {
          return;
        }
        link.href = resolvedUrl.toString();
      } catch (_error) {
        return;
      }

      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  }, [page.content, page.url]);

  // Check if Huntly server is configured
  useEffect(() => {
    readSyncStorageSettings().then((settings) => {
      setServerConfigured(!!settings.serverUrl);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (typeof initialThinkingModeEnabled === "boolean") {
      setThinkingModeEnabled(initialThinkingModeEnabled);
      return () => {
        cancelled = true;
      };
    }

    getThinkingModeEnabled().then((savedThinkingModeEnabled) => {
      if (!cancelled) {
        setThinkingModeEnabled(savedThinkingModeEnabled);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [initialThinkingModeEnabled]);

  const handleThinkingModeToggle = useCallback(() => {
    setThinkingModeEnabled((prev) => {
      const next = !prev;
      void saveThinkingModeEnabled(next);
      return next;
    });
  }, []);

  // Get shadow container for MUI Menu components
  const shadowContainer = useShadowContainer();

  const isSnippetMode = page.contentType === 4;

  // Get original content as markdown for export
  const originalMarkdown = useCallback(() => {
    const htmlContent = isSnippetMode
      ? page.description || page.content
      : page.content;
    return htmlToMarkdown(htmlContent);
  }, [page, isSnippetMode]);

  // Getter function for AI content element - used for export
  // This is passed as a function to ensure we always get the latest DOM element
  const getAiContentElement = useCallback((): HTMLElement | null => {
    return streamingRendererRef.current?.getContentElement() || null;
  }, []);

  // Get AI markdown for export
  const getAiMarkdown = useCallback(() => {
    return streamingRendererRef.current?.getProcessedMarkdown() || "";
  }, []);

  // Handle parser change
  const handleParserChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newParserType = e.target.value as ContentParserType;
      setParserType(newParserType);

      // Re-parse the document with the new parser
      const doc = document.cloneNode(true) as Document;
      const article = parseDocument(doc, newParserType);

      if (article) {
        const newPage: PageModel = {
          ...page,
          title: article.title || page.title,
          content: article.content,
          description: article.excerpt || page.description,
          author: article.byline || page.author,
          siteName: article.siteName || page.siteName,
        };
        setPage(newPage);
        onParserChange?.(newParserType, newPage);
      }
    },
    [page, onParserChange]
  );

  // Handle shortcut click from AIToolbar
  const handleShortcutClick = useCallback(
    (shortcut: ShortcutItem, selectedModel: ModelItem | null) => {
      if (isProcessing && currentTaskId) {
        chrome.runtime.sendMessage({
          type: "shortcuts_cancel",
          payload: { taskId: currentTaskId },
        });
      }

      setProcessingError(null);
      setIsProcessing(true);

      const newTaskId = `task_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}`;
      setCurrentTaskId(newTaskId);
      setShowProcessedSection(true);

      // Get HTML content to process
      const htmlContent = isSnippetMode
        ? page.description || page.content
        : page.content;
      // Convert HTML to markdown for AI processing
      const markdownContent = htmlToMarkdown(htmlContent);

      chrome.runtime.sendMessage({
        type: "shortcuts_process",
        payload: {
          tabId: null,
          taskId: newTaskId,
          shortcutId: shortcut.id,
          shortcutName: shortcut.name,
          shortcutContent: shortcut.content,
          shortcutType: shortcut.type,
          content: markdownContent, // Send markdown instead of HTML
          url: page.url,
          title: isSnippetMode ? "" : page.title,
          contentType: isSnippetMode ? 4 : undefined,
          selectedModel: selectedModel,
          thinkingModeEnabled,
          skipPreview: true, // Preview is already open, skip shortcuts_preview message
        },
      });
    },
    [isProcessing, currentTaskId, page, isSnippetMode, thinkingModeEnabled]
  );

  // Handle stop button click
  const handleStopClick = useCallback(() => {
    if (currentTaskId) {
      chrome.runtime.sendMessage({
        type: "shortcuts_cancel",
        payload: { taskId: currentTaskId },
      });
      setIsProcessing(false);
    }
  }, [currentTaskId]);

  // Message listener for processing events
  useEffect(() => {
    const messageListener = (msg: any) => {
      if (!currentTaskId || msg.payload?.taskId !== currentTaskId) return;

      switch (msg.type) {
        case "shortcuts_processing_start":
          setIsProcessing(true);
          break;
        case "shortcuts_process_result":
          setIsProcessing(false);
          break;
        case "shortcuts_process_error":
          setIsProcessing(false);
          setProcessingError(msg.payload?.error || "Processing failed");
          break;
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, [currentTaskId]);

  const sendRuntimeMessage = useCallback((message: unknown): Promise<any> => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }, []);

  const initEditPanel = useCallback(async () => {
    setEditLoading(true);
    setEditError(null);
    try {
      const response = await sendRuntimeMessage({
        type: "save_detail_init",
        payload: {
          data: {
            page: {
              title: page.title,
              description: page.description,
              url: page.url,
              domain: page.domain,
              faviconUrl: page.faviconUrl,
              thumbUrl: page.thumbUrl,
              content: page.content,
              contentType: page.contentType,
            },
            initialParserType: parserType,
            faviconUrl: page.faviconUrl,
          },
        },
      });
      if (!response?.success) {
        const errorMsg =
          response?.error || "Failed to initialize save details.";
        // Detect auth/login errors
        if (
          errorMsg.includes("401") ||
          errorMsg.includes("403") ||
          errorMsg.includes("Unauthorized") ||
          errorMsg.includes("Failed to fetch")
        ) {
          setEditError("Please log in to Huntly server first.");
        } else {
          setEditError(errorMsg);
        }
        return;
      }
      const data = response?.data || {};
      const detailData = {
        pageId: data.pageId,
        page: data.page || page,
        operateResult: data.operateResult,
        collectionTree: data.collectionTree,
      };
      setEditData(detailData);
    } catch (error) {
      setEditError(
        (error as Error)?.message || "Failed to initialize save details."
      );
    } finally {
      setEditLoading(false);
    }
  }, [page, parserType, sendRuntimeMessage]);

  const handleEditButtonClick = useCallback(() => {
    if (showEditPanel) {
      setShowEditPanel(false);
      return;
    }
    setShowEditPanel(true);
    if (!editData && !editLoading) {
      initEditPanel();
    }
  }, [editData, editLoading, initEditPanel, showEditPanel]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Auto-execute shortcut if provided (from popup)
  const autoExecuteRef = useRef(false);
  useEffect(() => {
    if (autoExecuteShortcut && !autoExecuteRef.current) {
      autoExecuteRef.current = true;
      // Small delay to ensure component is fully mounted
      setTimeout(() => {
        handleShortcutClick(autoExecuteShortcut, autoSelectedModel || null);
      }, 100);
    }
  }, [autoExecuteShortcut, autoSelectedModel, handleShortcutClick]);

  return (
    <div
      className="huntly-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-label="Article Preview"
    >
      <AIGradientDef />
      <div
        className="huntly-modal-content"
        style={{
          width: showProcessedSection ? "95%" : "70%",
          maxWidth: showProcessedSection ? "1600px" : "900px",
          height: "95%",
        }}
      >
        <div className="huntly-modal-inner">
          {/* Header bar */}
          <div className="huntly-header-bar">
            {/* AI Toolbar with Model Selector and Shortcuts */}
            <AIToolbar
              onShortcutClick={handleShortcutClick}
              isProcessing={isProcessing}
              onStopClick={handleStopClick}
              compact={false}
              menuContainer={shadowContainer || undefined}
              externalShortcuts={externalShortcuts}
              externalModels={externalModels}
              initialSelectedModel={autoSelectedModel}
              showThinkingToggle={true}
              thinkingModeEnabled={thinkingModeEnabled}
              onThinkingModeToggle={handleThinkingModeToggle}
            />

            {/* Right section: Export group, Edit button, Parser selector and Close button */}
            <div className="huntly-header-right">
              {/* Export button group (contains source toggle + export dropdown) */}
              <ExportButton
                originalContentRef={originalContentRef as React.RefObject<HTMLElement>}
                aiContentRef={getAiContentElement}
                originalMarkdown={originalMarkdown()}
                aiMarkdown={getAiMarkdown()}
                hasAiContent={showProcessedSection && !processingError}
                title={page.title || "huntly-export"}
                menuContainer={shadowContainer || undefined}
              />

              {/* Save detail button - only show when server is configured */}
              {serverConfigured && (
                <button
                  className="huntly-icon-button"
                  onClick={handleEditButtonClick}
                  title="Edit details"
                  disabled={editLoading}
                >
                  {editLoading ? (
                    <svg
                      className="huntly-icon-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        strokeDasharray="32"
                        strokeDashoffset="12"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                    </svg>
                  )}
                </button>
              )}
              {/* Parser selector */}
              <div className="huntly-parser-selector">
                <span className="huntly-parser-label">Parser:</span>
                <select
                  className="huntly-parser-select"
                  value={parserType}
                  onChange={handleParserChange}
                >
                  <option value="readability">Readability</option>
                  <option value="defuddle">Defuddle</option>
                </select>
              </div>

              {/* Close button */}
              <button className="huntly-close-button" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
          </div>

          {showEditPanel && (
            <>
              {/* Backdrop to close drawer on outside click */}
              <div
                className="huntly-edit-drawer-backdrop"
                onClick={() => setShowEditPanel(false)}
              />
              <div
                className="huntly-edit-drawer"
                role="dialog"
                aria-label="Edit details panel"
                onClick={(e) => e.stopPropagation()}
              >
                {editError && (
                  <div className="huntly-edit-alert huntly-edit-alert-error">
                    {editError}
                  </div>
                )}
                {editLoading ? (
                  <div className="huntly-edit-loading">Preparing editor...</div>
                ) : editData ? (
                  <div className="huntly-edit-panel-body">
                    <SaveDetailPanel
                      pageId={editData.pageId}
                      page={editData.page}
                      operateResult={editData.operateResult}
                      initialParserType={parserType}
                      faviconUrl={page.faviconUrl}
                      collectionTree={editData.collectionTree}
                      onClose={() => setShowEditPanel(false)}
                      onDeleted={() => {
                        setShowEditPanel(false);
                        setEditData(null);
                      }}
                      onOperateResultChanged={(result) => {
                        setEditData((prev) =>
                          prev ? { ...prev, operateResult: result } : prev
                        );
                      }}
                    />
                  </div>
                ) : (
                  <div className="huntly-edit-loading">
                    Unable to load editor.
                  </div>
                )}
              </div>
            </>
          )}

          {/* Content area */}
          <div className="huntly-content-area">
            {/* Article section */}
            <div
              className="huntly-article-section"
              style={{ width: showProcessedSection ? "50%" : "100%" }}
            >
              <div className="huntly-scroll-container">
                <article className="huntly-markdown-body" ref={originalContentRef}>
                  {!isSnippetMode && (
                    <h1 style={{ marginBottom: "16px" }}>{page.title}</h1>
                  )}
                  <div dangerouslySetInnerHTML={{ __html: page.content }} />
                </article>
              </div>
            </div>

            {/* Processed section */}
            {showProcessedSection && (
              <div className="huntly-processed-section">
                <div className="huntly-scroll-container">
                  {processingError ? (
                    <div style={{ color: "#d32f2f", padding: "16px" }}>
                      Error: {processingError}
                    </div>
                  ) : (
                    <StreamingContentRenderer
                      ref={streamingRendererRef}
                      currentTaskId={currentTaskId}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArticlePreview;
