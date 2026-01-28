import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TurndownService from "turndown";
import { ContentParserType } from "../storage";
import { parseDocument } from "../parser/contentParser";
import AIToolbar, { ShortcutItem, ModelItem, AIGradientDef, ExternalShortcutsData, ExternalModelsData } from "./AIToolbar";
import { useShadowContainer } from "./ShadowDomPreview";

// Create turndown instance for HTML to markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// Helper function to convert HTML to markdown
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  try {
    return turndownService.turndown(html);
  } catch (error) {
    console.error('Failed to convert HTML to markdown:', error);
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
}

// Streaming content renderer component
const StreamingContentRenderer = ({ currentTaskId }: { currentTaskId: string | null }) => {
  const [processedContent, setProcessedContent] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProcessedContent("");
    const messageListener = (msg: any) => {
      if (!currentTaskId || msg.payload?.taskId !== currentTaskId) return;
      if (msg.type === "shortcuts_process_data") {
        setProcessedContent(msg.payload.accumulatedContent);
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, [currentTaskId]);

  if (!processedContent) {
    return (
      <div className="huntly-loading-placeholder">
        {[100, 80, 60].map((width) => (
          <div key={`loading-${width}`} className="huntly-loading-bar" style={{ width: `${width}%` }} />
        ))}
      </div>
    );
  }

  return (
    <div ref={contentRef} className="huntly-markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{processedContent}</ReactMarkdown>
    </div>
  );
};

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
}) => {
  const [page, setPage] = useState<PageModel>(initialPage);
  const [parserType, setParserType] = useState<ContentParserType>(initialParserType);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProcessedSection, setShowProcessedSection] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Get shadow container for MUI Menu components
  const shadowContainer = useShadowContainer();

  const isSnippetMode = page.contentType === 4;

  // Handle parser change
  const handleParserChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
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
  }, [page, onParserChange]);

  // Handle shortcut click from AIToolbar
  const handleShortcutClick = useCallback((shortcut: ShortcutItem, selectedModel: ModelItem | null) => {
    if (isProcessing && currentTaskId) {
      chrome.runtime.sendMessage({
        type: "shortcuts_cancel",
        payload: { taskId: currentTaskId },
      });
    }

    setProcessingError(null);
    setIsProcessing(true);

    const newTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    setCurrentTaskId(newTaskId);
    setShowProcessedSection(true);

    // Get HTML content to process
    const htmlContent = isSnippetMode ? (page.description || page.content) : page.content;
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
      },
    });
  }, [isProcessing, currentTaskId, page, isSnippetMode]);

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
              compact={false}
              menuContainer={shadowContainer || undefined}
              externalShortcuts={externalShortcuts}
              externalModels={externalModels}
              initialSelectedModel={autoSelectedModel}
            />

            {/* Right section: Parser selector and Close button */}
            <div className="huntly-header-right">
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

          {/* Content area */}
          <div className="huntly-content-area">
            {/* Article section */}
            <div
              className="huntly-article-section"
              style={{ width: showProcessedSection ? "50%" : "100%" }}
            >
              <div className="huntly-scroll-container">
                <article className="huntly-markdown-body">
                  {!isSnippetMode && <h1 style={{ marginBottom: "16px" }}>{page.title}</h1>}
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
                    <StreamingContentRenderer currentTaskId={currentTaskId} />
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

