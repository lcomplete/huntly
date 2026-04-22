import { log } from "./logger";
import { isDebugging } from "./env";
import {
  readSyncStorageSettings,
  getPromptsSettings,
  getLanguageNativeName,
} from "./storage";
import {
  autoSaveArticle,
  saveArticle,
  sendData,
  fetchEnabledShortcuts,
  getApiBaseUrl,
  getPageOperateResult,
  savePageToLibrary,
  getPageDetail,
  getCollectionTree,
} from "./services";
import { combineUrl } from "./utils";
import { sseRequestManager } from "./sseTaskManager";
import {
  getAIProvidersStorage,
  getAvailableProviderTypes,
  getEffectiveDefaultProviderType,
} from "./ai/storage";
import { PROVIDER_REGISTRY, ProviderType } from "./ai/types";
import { createProviderModel } from "./ai/providers";
import {
  applyStreamingPreviewChunk,
  createStreamingPreviewState,
  getStreamingPreviewResult,
  hasStreamingPreviewStateChanged,
} from "./ai/streamingPreview";
import { streamText } from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
// Note: turndown is not used here because service worker has no DOM
// HTML to markdown conversion should be done in content script/popup before sending to background

// Store AbortControllers for Vercel AI tasks
const vercelAIAbortControllers = new Map<string, AbortController>();

// Badge management: cache to avoid redundant API calls
// Maps tabId -> url to track which URL was last checked for each tab
const badgeCache = new Map<number, string>();
const SAVED_BADGE_TEXT = "✓";
const SAVED_BADGE_BG = "#15803D";
const AI_MAX_OUTPUT_TOKENS = 20000;
const ANTHROPIC_THINKING_BUDGET_TOKENS = 4000;

function buildThinkingProviderOptions(): ProviderOptions {
  return {
    anthropic: {
      thinking: {
        type: "enabled",
        budgetTokens: ANTHROPIC_THINKING_BUDGET_TOKENS,
      },
    },
    deepseek: {
      thinking: { type: "enabled" },
    },
    google: {
      thinkingConfig: {
        thinkingLevel: "high",
        includeThoughts: true,
      },
    },
    groq: {
      reasoningEffort: "high",
    },
    openai: {
      systemMessageMode: "system",
      reasoningEffort: "high",
      reasoningSummary: "auto",
      forceReasoning: true,
    },
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const contentType = blob.type || "application/octet-stream";
  const buffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  return `data:${contentType};base64,${base64}`;
}

/**
 * Update the badge for a tab based on whether the page is saved in Huntly
 * @param tabId The tab ID to update
 * @param url The URL to check
 * @param forceRefresh If true, bypass the cache and re-check the URL
 */
async function updateBadgeForTab(
  tabId: number,
  url: string,
  forceRefresh: boolean = false
): Promise<void> {
  try {
    // Skip non-http(s) URLs
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      chrome.action.setBadgeText({ text: "", tabId });
      return;
    }

    // Check if server URL is configured
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
      // No server configured, clear badge
      chrome.action.setBadgeText({ text: "", tabId });
      return;
    }

    // Check cache to avoid redundant API calls (unless force refresh)
    if (!forceRefresh) {
      const cachedUrl = badgeCache.get(tabId);
      if (cachedUrl === url) {
        // Already checked this URL for this tab, skip
        return;
      }
    }

    // Update cache
    badgeCache.set(tabId, url);

    // Call API to check if page is saved
    const result = await getPageOperateResult(0, url);
    if (result) {
      const pageData = JSON.parse(result);
      if (pageData && pageData.id && pageData.id > 0) {
        // Page is saved, show badge
        chrome.action.setBadgeText({ text: SAVED_BADGE_TEXT, tabId });
        chrome.action.setBadgeBackgroundColor({ color: SAVED_BADGE_BG, tabId });
      } else {
        // Page is not saved, clear badge
        chrome.action.setBadgeText({ text: "", tabId });
      }
    } else {
      // No result, clear badge
      chrome.action.setBadgeText({ text: "", tabId });
    }
  } catch (error) {
    // API error (server offline, etc.), silently clear badge
    chrome.action.setBadgeText({ text: "", tabId });
  }
}

// Cancel a Vercel AI task
function cancelVercelAITask(taskId: string): boolean {
  const controller = vercelAIAbortControllers.get(taskId);
  if (controller) {
    controller.abort();
    vercelAIAbortControllers.delete(taskId);
    return true;
  }
  return false;
}

function startProcessingWithShortcuts(
  task: any,
  shortcuts: any[],
  skipPreview: boolean = false
) {
  if (!task) return;

  // Function to start the actual processing
  const startProcessing = () => {
    // 发送处理开始的消息
    chrome.tabs.sendMessage(task.tabId, {
      type: "shortcuts_processing_start",
      payload: {
        title: task.shortcutName,
        shortcutName: task.shortcutName,
        taskId: task.taskId,
      },
    });

    let accumulatedContent = "";

    // 使用新的 SSERequestManager 处理文章内容
    sseRequestManager.processContentWithShortcutStream(
      task.taskId,
      task.tabId,
      task.content,
      task.shortcutId,
      task.shortcutName,
      task.url,
      task.title, // 传递文章标题
      // onData callback - 接收流式数据
      (data: string, taskId: string) => {
        accumulatedContent += data;

        // 发送流式数据到预览页面
        try {
          chrome.tabs.sendMessage(task.tabId, {
            type: "shortcuts_process_data",
            payload: {
              data: data,
              accumulatedContent: accumulatedContent,
              title: task.shortcutName,
              taskId: taskId,
            },
          });
        } catch (error) {
          console.warn("Failed to send shortcuts_process_data message:", error);
          // Tab可能已关闭，取消当前任务
          sseRequestManager.cancelTask(taskId);
        }
      },
      // onEnd callback - 处理完成
      (taskId: string) => {
        // 发送处理结果到预览页面
        try {
          chrome.tabs.sendMessage(task.tabId, {
            type: "shortcuts_process_result",
            payload: {
              content: accumulatedContent,
              title: task.shortcutName,
              taskId: taskId,
            },
          });
        } catch (error) {
          console.warn(
            "Failed to send shortcuts_process_result message:",
            error
          );
        }
      },
      // onError callback - 处理错误
      (error: any, taskId: string) => {
        console.error(
          "Error processing with shortcut for task:",
          taskId,
          error
        );

        try {
          chrome.tabs.sendMessage(task.tabId, {
            type: "shortcuts_process_error",
            payload: {
              error: error.message || "Processing failed",
              title: task.shortcutName,
              taskId: taskId,
            },
          });
        } catch (sendError) {
          console.warn(
            "Failed to send shortcuts_process_error message:",
            sendError
          );
        }
      }
    );
  };

  // If preview is already open, skip sending shortcuts_preview message
  if (skipPreview) {
    startProcessing();
    return;
  }

  // Send shortcuts_preview to open the preview window first
  chrome.tabs.sendMessage(
    task.tabId,
    {
      type: "shortcuts_preview",
      payload: {
        shortcuts: shortcuts,
        taskId: task.taskId,
        page: {
          title: task.title,
          content: task.content,
          url: task.url,
          description: "",
          thumbUrl: "",
          author: "",
          siteName: "",
          language: "",
          category: "",
          isLiked: false,
          isFavorite: false,
          domain: "",
          faviconUrl: "",
          contentType: task.contentType, // Pass contentType for snippet mode
        },
      },
    },
    function (response) {
      startProcessing();
    }
  );
}

// Prepare markdown content with title prefix
function prepareMarkdownContent(
  markdownContent: string,
  title?: string
): string {
  // If title exists, add it to the content beginning
  if (title && title.trim()) {
    return `# ${title}\n\n${markdownContent}`;
  }
  return markdownContent;
}

// Process content with Vercel AI SDK (for non-Huntly models)
async function startProcessingWithVercelAI(task: any) {
  if (!task) return;

  const {
    tabId,
    taskId,
    shortcutName,
    shortcutContent,
    content,
    title,
    selectedModel,
    thinkingModeEnabled,
  } = task;

  // Create AbortController for this task
  const abortController = new AbortController();
  vercelAIAbortControllers.set(taskId, abortController);

  // Send processing start message
  chrome.tabs.sendMessage(tabId, {
    type: "shortcuts_processing_start",
    payload: {
      title: shortcutName,
      shortcutName: shortcutName,
      taskId: taskId,
    },
  });

  try {
    const sendStreamingPreviewUpdate = (
      streamState: ReturnType<typeof createStreamingPreviewState>,
      data: string
    ) => {
      chrome.tabs.sendMessage(tabId, {
        type: "shortcuts_process_data",
        payload: {
          data,
          accumulatedContent: streamState.displayContent,
          answerContent: streamState.responseContent,
          reasoningContent: streamState.reasoningContent,
          isThinking: streamState.isThinking,
          title: shortcutName,
          taskId: taskId,
        },
      });
    };

    // Get provider config
    const storage = await getAIProvidersStorage();
    const providerType = selectedModel.provider as ProviderType;
    const config = storage.providers[providerType];

    if (!config || !config.enabled) {
      throw new Error(`Provider ${providerType} is not configured or enabled`);
    }

    // Extract model ID from the selectedModel.id (format: "provider:modelId")
    const modelId = selectedModel.id.split(":").slice(1).join(":");

    // Get default target language for {lang} replacement
    const promptsSettings = await getPromptsSettings();
    const defaultTargetLanguage =
      promptsSettings.defaultTargetLanguage || "English";

    // Build the prompt: replace {lang} placeholder with native language name
    const nativeLanguageName = getLanguageNativeName(defaultTargetLanguage);
    const systemPrompt = (shortcutContent || "").replace(
      /\{lang\}/g,
      nativeLanguageName
    );

    // Prepare user prompt: content is already markdown (converted in ArticlePreview), add title prefix
    const userPrompt = prepareMarkdownContent(content, title);

    let streamState = createStreamingPreviewState();
    const includeReasoningPreview = Boolean(thinkingModeEnabled);

    // Create the model
    const model = createProviderModel(config, modelId);
    if (!model) {
      throw new Error(`Failed to create model for ${providerType}`);
    }

    // Use streamText for streaming response with abort signal
    const result = streamText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
      abortSignal: abortController.signal,
      providerOptions: thinkingModeEnabled
        ? buildThinkingProviderOptions()
        : undefined,
    });

    // Process the full stream so providers that emit reasoning deltas before
    // text deltas (for example, glm-5) still produce visible incremental output.
    for await (const chunk of result.fullStream) {
      // Check if aborted
      if (abortController.signal.aborted) {
        break;
      }

      const nextStreamState = applyStreamingPreviewChunk(streamState, chunk, {
        includeReasoning: includeReasoningPreview,
      });
      if (!hasStreamingPreviewStateChanged(streamState, nextStreamState)) {
        continue;
      }
      streamState = nextStreamState;

      // Send streaming data to preview
      try {
        sendStreamingPreviewUpdate(
          streamState,
          chunk.type === "text-delta" || chunk.type === "reasoning-delta"
            ? chunk.text
            : ""
        );
      } catch (error) {
        console.warn("Failed to send shortcuts_process_data message:", error);
        break;
      }
    }

    // Clean up AbortController
    vercelAIAbortControllers.delete(taskId);

    // Only send completion if not aborted
    if (!abortController.signal.aborted) {
      const finalContent = getStreamingPreviewResult(streamState);
      try {
        chrome.tabs.sendMessage(tabId, {
          type: "shortcuts_process_result",
          payload: {
            content: finalContent,
            reasoningContent: streamState.reasoningContent,
            isThinking: false,
            title: shortcutName,
            taskId: taskId,
          },
        });
      } catch (error) {
        console.warn("Failed to send shortcuts_process_result message:", error);
      }
    }
  } catch (error: any) {
    // Clean up AbortController
    vercelAIAbortControllers.delete(taskId);

    // Don't report error if it was aborted
    if (abortController.signal.aborted) {
      log("Task was cancelled:", taskId);
      return;
    }

    console.error(
      "Error processing with Vercel AI SDK for task:",
      taskId,
      error
    );

    try {
      chrome.tabs.sendMessage(tabId, {
        type: "shortcuts_process_error",
        payload: {
          error: error.message || "Processing failed",
          title: shortcutName,
          taskId: taskId,
        },
      });
    } catch (sendError) {
      console.warn(
        "Failed to send shortcuts_process_error message:",
        sendError
      );
    }
  }
}

export function initBackground(): void {
  chrome.runtime.onMessage.addListener(function (
    msg: Message,
    sender,
    sendResponse
  ) {
    if (msg.type === "auto_save_clipper") {
      autoSaveArticle(msg.payload).then(handleSaveArticleResponse);
    } else if (msg.type === "save_clipper") {
      saveArticle(msg.payload);
    } else if (msg.type === "auto_save_tweets") {
      readSyncStorageSettings().then((settings) => {
        if (settings.autoSaveTweet) {
          sendData("tweet/saveTweets", msg.payload);
        }
      });
    } else if (msg.type === "read_tweet") {
      sendData("tweet/trackRead", msg.payload);
    } else if (msg.type === "shortcuts_process") {
      const selectedModel = msg.payload.selectedModel;
      const isHuntlyServer = selectedModel?.provider === "huntly-server";

      if (isHuntlyServer) {
        const task = {
          tabId: msg.payload.tabId || sender.tab?.id,
          taskId: msg.payload.taskId,
          shortcutId: msg.payload.shortcutId,
          shortcutName: msg.payload.shortcutName,
          content: msg.payload.content,
          url: msg.payload.url,
          title: msg.payload.title || "",
          contentType: msg.payload.contentType,
        };
        const shortcuts = msg.payload.shortcuts || [];
        const skipPreview = msg.payload.skipPreview || false;
        startProcessingWithShortcuts(task, shortcuts, skipPreview);
      } else {
        const task = {
          tabId: msg.payload.tabId || sender.tab?.id,
          taskId: msg.payload.taskId,
          shortcutName: msg.payload.shortcutName,
          shortcutContent: msg.payload.shortcutContent,
          content: msg.payload.content,
          url: msg.payload.url,
          title: msg.payload.title || "",
          contentType: msg.payload.contentType,
          selectedModel: selectedModel,
          thinkingModeEnabled: Boolean(msg.payload.thinkingModeEnabled),
        };
        startProcessingWithVercelAI(task);
      }
    } else if (msg.type === "shortcuts_cancel") {
      const taskId = msg.payload.taskId;
      const sseCancelled = sseRequestManager.cancelTask(taskId);
      const vercelCancelled = cancelVercelAITask(taskId);
      if (sseCancelled || vercelCancelled) {
        log("Processing cancelled for task:", taskId);
      }
    } else if (msg.type === "get_huntly_shortcuts") {
      fetchEnabledShortcuts()
        .then((shortcuts) => {
          sendResponse({ success: true, shortcuts: shortcuts || [] });
        })
        .catch((error) => {
          console.error("Failed to fetch huntly shortcuts:", error);
          sendResponse({ success: false, shortcuts: [], error: error.message });
        });
      return true;
    } else if (msg.type === "get_ai_toolbar_data") {
      getAIToolbarData()
        .then((data) => {
          sendResponse({ success: true, ...data });
        })
        .catch((error) => {
          console.error("Failed to get AI toolbar data:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    } else if ((msg as any).type === "open_tab") {
      const openTabMsg = msg as Message & { url?: string };
      const url = openTabMsg.url || openTabMsg.payload?.url;
      if (url) {
        chrome.tabs.create({ url });
      }
    } else if ((msg as any).type === "open_side_panel") {
      openSidePanelForContextMenuClick(sender.tab);
    } else if ((msg as any).type === "fetch_image") {
      const imageUrl = msg.payload?.url;
      if (!imageUrl) {
        sendResponse({ success: false, error: "No URL provided" });
        return;
      }
      (async () => {
        try {
          const response = await fetch(imageUrl, { credentials: "omit" });
          if (!response.ok) {
            sendResponse({ success: false, error: `HTTP ${response.status}` });
            return;
          }
          const contentType = response.headers.get("content-type") || "";
          if (!contentType.startsWith("image/")) {
            sendResponse({ success: false, error: "Not an image" });
            return;
          }
          const blob = await response.blob();
          const dataUrl = await blobToDataUrl(blob);
          sendResponse({ success: true, dataUrl });
        } catch (error) {
          sendResponse({ success: false, error: (error as Error)?.message || "Fetch failed" });
        }
      })();
      return true;
    } else if ((msg as any).type === "badge_refresh") {
      const tabId = msg.payload?.tabId;
      const url = msg.payload?.url;
      if (tabId && url) {
        updateBadgeForTab(tabId, url, true);
      } else {
        refreshBadgeForActiveTab();
      }
    } else if ((msg as any).type === "http_proxy") {
      const { method, baseUrl, url, data } = msg.payload || {};
      if (!baseUrl || !url) {
        sendResponse({ success: false, error: "Invalid proxy request." });
        return;
      }

      (async () => {
        try {
          const fullUrl = combineUrl(baseUrl, url);
          const init: RequestInit = {
            method: method || "GET",
            cache: "no-cache",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          };
          if (data !== undefined && method !== "GET" && method !== "DELETE") {
            init.body = JSON.stringify(data);
          }

          const response = await fetch(fullUrl, init);
          const text = await response.text();
          sendResponse({ success: true, data: text, status: response.status });
        } catch (error) {
          sendResponse({
            success: false,
            error: (error as Error)?.message || "http_proxy failed",
          });
        }
      })();
      return true;
    } else if ((msg as any).type === "save_detail_init") {
      const { data } = msg.payload || {};
      const inputPage = data?.page as PageModel | undefined;
      if (!inputPage?.url) {
        sendResponse({
          success: false,
          error: "Invalid page data for save detail initialization.",
        });
        return;
      }

      (async () => {
        try {
          const resp = await saveArticle(inputPage);
          if (!resp) {
            sendResponse({ success: false, error: "Failed to save page." });
            return;
          }
          const json = JSON.parse(resp);
          const pageId = json?.data as number;
          if (!pageId || pageId <= 0) {
            sendResponse({
              success: false,
              error: "Invalid page id from save API.",
            });
            return;
          }

          const operateResult = await savePageToLibrary(pageId);
          const detail = await getPageDetail(pageId);
          const dbPage = detail?.page || {};
          const collectionTree = await getCollectionTree();

          sendResponse({
            success: true,
            data: {
              pageId,
              operateResult,
              collectionTree,
              page: {
                ...inputPage,
                title: dbPage.title || inputPage.title,
                description: dbPage.description || inputPage.description,
                url: dbPage.url || inputPage.url,
                domain: dbPage.domain || inputPage.domain,
                faviconUrl: dbPage.faviconUrl || inputPage.faviconUrl,
                thumbUrl: dbPage.thumbUrl || inputPage.thumbUrl,
              },
            },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: (error as Error)?.message || "save_detail_init failed",
          });
        }
      })();
      return true;
    }
  });

  registerBackgroundUiListeners();
}

// Helper function to get all AI toolbar data
async function getAIToolbarData() {
  // Load shortcuts data
  const promptsSettings = await getPromptsSettings();
  const enabledPrompts = promptsSettings.prompts.filter((p) => p.enabled);
  const userPrompts = enabledPrompts.filter((p) => !p.isSystem);
  const systemPrompts = enabledPrompts.filter((p) => p.isSystem);
  const huntlyShortcutsEnabled = promptsSettings.huntlyShortcutsEnabled;

  // Load huntly shortcuts if enabled
  let huntlyShortcuts: any[] = [];
  const baseUrl = await getApiBaseUrl();
  if (baseUrl && huntlyShortcutsEnabled) {
    try {
      huntlyShortcuts = await fetchEnabledShortcuts();
    } catch (error) {
      console.error("Failed to fetch huntly shortcuts:", error);
    }
  }

  // Load models data
  interface ModelItem {
    id: string;
    name: string;
    provider: string;
    providerName: string;
  }
  const modelList: ModelItem[] = [];
  const storage = await getAIProvidersStorage();
  const availableProviders = await getAvailableProviderTypes();

  // Add Huntly Server models first (only if huntlyShortcutsEnabled)
  if (baseUrl && huntlyShortcutsEnabled) {
    modelList.push({
      id: "huntly-server:default",
      name: "Huntly AI",
      provider: "huntly-server",
      providerName: "Huntly",
    });
  }

  // Add models from enabled providers
  for (const providerType of availableProviders) {
    if (providerType === "huntly-server") continue;

    const config = storage.providers[providerType];
    if (config?.enabled && config.enabledModels.length > 0) {
      const providerMeta = PROVIDER_REGISTRY[providerType];
      for (const modelId of config.enabledModels) {
        const modelMeta = providerMeta.defaultModels.find(
          (m) => m.id === modelId
        );
        modelList.push({
          id: `${providerType}:${modelId}`,
          name: modelMeta?.name || modelId,
          provider: providerType,
          providerName: providerMeta.displayName,
        });
      }
    }
  }

  // Determine default model
  let defaultModel: ModelItem | null = null;
  if (modelList.length > 0) {
    const defaultProviderType = await getEffectiveDefaultProviderType();
    if (defaultProviderType) {
      defaultModel =
        modelList.find((m) => m.provider === defaultProviderType) ||
        modelList[0];
    } else {
      defaultModel = modelList[0];
    }
  }

  return {
    externalShortcuts: {
      userPrompts,
      systemPrompts,
      huntlyShortcuts,
      huntlyShortcutsEnabled,
    },
    externalModels: {
      models: modelList,
      defaultModel,
    },
  };
}

function handleSaveArticleResponse(resp: string) {
  log("save article result", resp);
  if (resp) {
    const json = JSON.parse(resp);
    chrome.runtime.sendMessage({
      type: "save_clipper_success",
      payload: { id: json.data },
    });
    // Update badge for the active tab after auto-save
    refreshBadgeForActiveTab();
  }
}

/**
 * Refresh the badge for the currently active tab (force re-check)
 */
function refreshBadgeForActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    if (tab?.id && tab?.url) {
      updateBadgeForTab(tab.id, tab.url, true);
    }
  });
}

const CONTEXT_MENU_HUNTLY_ROOT = "huntly_root";
const CONTEXT_MENU_READING_MODE_PAGE = "huntly_reading_mode_page";
const CONTEXT_MENU_SIDE_PANEL_PAGE = "huntly_side_panel_page";
const CONTEXT_MENU_READING_MODE_ACTION = "huntly_reading_mode_action";
const CONTEXT_MENU_SIDE_PANEL_ACTION = "huntly_side_panel_action";
const CONTEXT_MENU_PAGE_CONTEXTS = ["page", "selection"];
const CONTEXT_MENU_ACTION_CONTEXTS = ["action"];

const HUNTLY_MENU_TITLE = isDebugging ? "Huntly [DEV]" : "Huntly";
const READING_MODE_TITLE = "Reading Mode";
const SIDE_PANEL_TITLE = "Chat";

function createContextMenuItem(
  properties: chrome.contextMenus.CreateProperties
) {
  chrome.contextMenus.create(properties, () => {
    if (chrome.runtime.lastError) {
      log("Failed to create context menu item:", chrome.runtime.lastError);
    }
  });
}

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      log("Failed to reset context menus:", chrome.runtime.lastError);
    }

    createContextMenuItem({
      id: CONTEXT_MENU_HUNTLY_ROOT,
      title: HUNTLY_MENU_TITLE,
      contexts: CONTEXT_MENU_PAGE_CONTEXTS,
    });

    createContextMenuItem({
      id: CONTEXT_MENU_READING_MODE_PAGE,
      parentId: CONTEXT_MENU_HUNTLY_ROOT,
      title: READING_MODE_TITLE,
      contexts: CONTEXT_MENU_PAGE_CONTEXTS,
    });

    createContextMenuItem({
      id: CONTEXT_MENU_SIDE_PANEL_PAGE,
      parentId: CONTEXT_MENU_HUNTLY_ROOT,
      title: SIDE_PANEL_TITLE,
      contexts: CONTEXT_MENU_PAGE_CONTEXTS,
    });

    createContextMenuItem({
      id: CONTEXT_MENU_READING_MODE_ACTION,
      title: READING_MODE_TITLE,
      contexts: CONTEXT_MENU_ACTION_CONTEXTS,
    });

    createContextMenuItem({
      id: CONTEXT_MENU_SIDE_PANEL_ACTION,
      title: SIDE_PANEL_TITLE,
      contexts: CONTEXT_MENU_ACTION_CONTEXTS,
    });
  });
}

async function getCurrentActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function resolveContextMenuTab(
  tab?: chrome.tabs.Tab
): Promise<chrome.tabs.Tab | undefined> {
  if (tab?.id) {
    return tab;
  }

  return getCurrentActiveTab();
}

function openSidePanelForContextMenuClick(tab?: chrome.tabs.Tab): void {
  const sidePanelApi = (chrome as any).sidePanel;
  if (!sidePanelApi?.open) {
    return;
  }

  if (typeof tab?.windowId !== "number") {
    log("Failed to open side panel: missing windowId from context menu tab");
    return;
  }

  void sidePanelApi.open({ windowId: tab.windowId }).catch((error: unknown) => {
    log("Failed to open side panel:", error);
  });
}

function isReadingModeMenuItem(menuItemId: string | number): boolean {
  return (
    menuItemId === CONTEXT_MENU_READING_MODE_PAGE ||
    menuItemId === CONTEXT_MENU_READING_MODE_ACTION
  );
}

function isSidePanelMenuItem(menuItemId: string | number): boolean {
  return (
    menuItemId === CONTEXT_MENU_SIDE_PANEL_PAGE ||
    menuItemId === CONTEXT_MENU_SIDE_PANEL_ACTION
  );
}

async function handleReadingModeContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<void> {
  const targetTab = await resolveContextMenuTab(tab);

  if (!targetTab?.id) return;

  if (info.selectionText?.trim()) {
    // Get selection content from content script and open snippet reading mode
    chrome.tabs.sendMessage(
      targetTab.id,
      { type: "get_selection" },
      (response) => {
        if (chrome.runtime.lastError) {
          log("Failed to get selection:", chrome.runtime.lastError);
          return;
        }

        const page = response?.page;
        if (page) {
          // Open reading mode with snippet
          chrome.tabs.sendMessage(targetTab.id, {
            type: "shortcuts_preview",
            payload: {
              page: page,
            },
          });
        }
      }
    );
  } else {
    // Open full page reading mode
    chrome.tabs.sendMessage(targetTab.id, {
      type: "shortcuts_preview",
      payload: {
        page: null, // null means content script will parse the current page
      },
    });
  }
}

function registerBackgroundUiListeners(): void {
  chrome.tabs.onUpdated.addListener(function (tabId: number, changeInfo, tab) {
    if (changeInfo.status == "complete") {
      chrome.tabs.sendMessage<Message>(tabId, {
        type: "tab_complete",
      });

      if (tab.url) {
        updateBadgeForTab(tabId, tab.url);
      }
    }

    if (changeInfo.url) {
      badgeCache.delete(tabId);
      updateBadgeForTab(tabId, changeInfo.url);
    }
  });

  chrome.tabs.onActivated.addListener(function (activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function (tab) {
      if (tab.url) {
        updateBadgeForTab(activeInfo.tabId, tab.url);
      }
    });
  });

  chrome.tabs.onRemoved.addListener(function (tabId) {
    const cancelledCount = sseRequestManager.cancelTasksByTabId(tabId);

    if (cancelledCount > 0) {
      log(
        `Processing cancelled for ${cancelledCount} tasks due to tab ${tabId} close`
      );
    }

    badgeCache.delete(tabId);
  });

  chrome.runtime.onInstalled.addListener(setupContextMenus);
  chrome.runtime.onStartup.addListener(setupContextMenus);

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (isSidePanelMenuItem(info.menuItemId)) {
      openSidePanelForContextMenuClick(tab);
      return;
    }

    if (!isReadingModeMenuItem(info.menuItemId)) return;

    void handleReadingModeContextMenuClick(info, tab);
  });
}
