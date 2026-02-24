import {log} from "./logger";
import {isDebugging} from "./env";
import {readSyncStorageSettings, getPromptsSettings, getLanguageNativeName} from "./storage";
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
import {sseRequestManager} from "./sseTaskManager";
import {
  getAIProvidersStorage,
  getAvailableProviderTypes,
  getEffectiveDefaultProviderType,
} from "./ai/storage";
import { PROVIDER_REGISTRY, ProviderType } from "./ai/types";
import { createProviderModel } from "./ai/providers";
import { streamText } from "ai";
// Note: turndown is not used here because service worker has no DOM
// HTML to markdown conversion should be done in content script/popup before sending to background

// Store AbortControllers for Vercel AI tasks
const vercelAIAbortControllers = new Map<string, AbortController>();

// Badge management: cache to avoid redundant API calls
// Maps tabId -> url to track which URL was last checked for each tab
const badgeCache = new Map<number, string>();
const SAVED_BADGE_TEXT = "✓";
const SAVED_BADGE_BG = "#15803D";

/**
 * Update the badge for a tab based on whether the page is saved in Huntly
 * @param tabId The tab ID to update
 * @param url The URL to check
 * @param forceRefresh If true, bypass the cache and re-check the URL
 */
async function updateBadgeForTab(tabId: number, url: string, forceRefresh: boolean = false): Promise<void> {
  try {
    // Skip non-http(s) URLs
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
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

function startProcessingWithShortcuts(task: any, shortcuts: any[], skipPreview: boolean = false) {
  if (!task) return;

  // Function to start the actual processing
  const startProcessing = () => {
    // 发送处理开始的消息
    chrome.tabs.sendMessage(task.tabId, {
      type: 'shortcuts_processing_start',
      payload: {
        title: task.shortcutName,
        shortcutName: task.shortcutName,
        taskId: task.taskId
      }
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
            type: 'shortcuts_process_data',
            payload: {
              data: data,
              accumulatedContent: accumulatedContent,
              title: task.shortcutName,
              taskId: taskId
            }
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
            type: 'shortcuts_process_result',
            payload: {
              content: accumulatedContent,
              title: task.shortcutName,
              taskId: taskId
            }
          });
        } catch (error) {
          console.warn("Failed to send shortcuts_process_result message:", error);
        }
      },
      // onError callback - 处理错误
      (error: any, taskId: string) => {
        console.error("Error processing with shortcut for task:", taskId, error);

        try {
          chrome.tabs.sendMessage(task.tabId, {
            type: 'shortcuts_process_error',
            payload: {
              error: error.message || 'Processing failed',
              title: task.shortcutName,
              taskId: taskId
            }
          });
        } catch (sendError) {
          console.warn("Failed to send shortcuts_process_error message:", sendError);
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
  chrome.tabs.sendMessage(task.tabId, {
    type: 'shortcuts_preview',
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
      }
    }
  }, function(response) {
    startProcessing();
  });
}

// Prepare markdown content with title prefix
function prepareMarkdownContent(markdownContent: string, title?: string): string {
  // If title exists, add it to the content beginning
  if (title && title.trim()) {
    return `# ${title}\n\n${markdownContent}`;
  }
  return markdownContent;
}

// Process content with Vercel AI SDK (for non-Huntly models)
async function startProcessingWithVercelAI(task: any) {
  if (!task) return;

  const { tabId, taskId, shortcutName, shortcutContent, content, title, selectedModel } = task;

  // Create AbortController for this task
  const abortController = new AbortController();
  vercelAIAbortControllers.set(taskId, abortController);

  // Send processing start message
  chrome.tabs.sendMessage(tabId, {
    type: 'shortcuts_processing_start',
    payload: {
      title: shortcutName,
      shortcutName: shortcutName,
      taskId: taskId
    }
  });

  try {
    // Get provider config
    const storage = await getAIProvidersStorage();
    const providerType = selectedModel.provider as ProviderType;
    const config = storage.providers[providerType];

    if (!config || !config.enabled) {
      throw new Error(`Provider ${providerType} is not configured or enabled`);
    }

    // Extract model ID from the selectedModel.id (format: "provider:modelId")
    const modelId = selectedModel.id.split(':').slice(1).join(':');

    // Create the model
    const model = createProviderModel(config, modelId);
    if (!model) {
      throw new Error(`Failed to create model for ${providerType}`);
    }

    // Get default target language for {lang} replacement
    const promptsSettings = await getPromptsSettings();
    const defaultTargetLanguage = promptsSettings.defaultTargetLanguage || 'English';

    // Build the prompt: replace {lang} placeholder with native language name
    const nativeLanguageName = getLanguageNativeName(defaultTargetLanguage);
    const systemPrompt = (shortcutContent || '').replace(/\{lang\}/g, nativeLanguageName);

    // Prepare user prompt: content is already markdown (converted in ArticlePreview), add title prefix
    const userPrompt = prepareMarkdownContent(content, title);

    let accumulatedContent = "";

    // Use streamText for streaming response with abort signal
    const result = await streamText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 8000,
      abortSignal: abortController.signal,
    });

    // Process the stream
    for await (const textPart of result.textStream) {
      // Check if aborted
      if (abortController.signal.aborted) {
        break;
      }

      accumulatedContent += textPart;

      // Send streaming data to preview
      try {
        chrome.tabs.sendMessage(tabId, {
          type: 'shortcuts_process_data',
          payload: {
            data: textPart,
            accumulatedContent: accumulatedContent,
            title: shortcutName,
            taskId: taskId
          }
        });
      } catch (error) {
        console.warn("Failed to send shortcuts_process_data message:", error);
        break;
      }
    }

    // Clean up AbortController
    vercelAIAbortControllers.delete(taskId);

    // Only send completion if not aborted
    if (!abortController.signal.aborted) {
      try {
        chrome.tabs.sendMessage(tabId, {
          type: 'shortcuts_process_result',
          payload: {
            content: accumulatedContent,
            title: shortcutName,
            taskId: taskId
          }
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

    console.error("Error processing with Vercel AI SDK for task:", taskId, error);

    try {
      chrome.tabs.sendMessage(tabId, {
        type: 'shortcuts_process_error',
        payload: {
          error: error.message || 'Processing failed',
          title: shortcutName,
          taskId: taskId
        }
      });
    } catch (sendError) {
      console.warn("Failed to send shortcuts_process_error message:", sendError);
    }
  }
}

chrome.runtime.onMessage.addListener(function (msg: Message, sender, sendResponse) {
  if (msg.type === "auto_save_clipper") {
    autoSaveArticle(msg.payload).then(handleSaveArticleResponse);
  } else if (msg.type === "save_clipper") {
    saveArticle(msg.payload);
  } else if (msg.type === 'auto_save_tweets') {
    readSyncStorageSettings().then((settings) => {
      if (settings.autoSaveTweet) {
        sendData("tweet/saveTweets", msg.payload);
      }
    });
  } else if (msg.type === 'read_tweet') {
    sendData("tweet/trackRead", msg.payload);
  } else if (msg.type === 'shortcuts_process') {
    const selectedModel = msg.payload.selectedModel;
    const isHuntlyServer = selectedModel?.provider === 'huntly-server';

    if (isHuntlyServer) {
      // Use Huntly Server SSE API
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
      // Use Vercel AI SDK for other providers
      const task = {
        tabId: msg.payload.tabId || sender.tab?.id,
        taskId: msg.payload.taskId,
        shortcutName: msg.payload.shortcutName,
        shortcutContent: msg.payload.shortcutContent, // The prompt content
        content: msg.payload.content,
        url: msg.payload.url,
        title: msg.payload.title || "",
        contentType: msg.payload.contentType,
        selectedModel: selectedModel,
      };
      startProcessingWithVercelAI(task);
    }
  } else if (msg.type === 'shortcuts_cancel') {
    // 根据 taskId 取消处理任务
    const taskId = msg.payload.taskId;
    // Try to cancel SSE task (Huntly server) or Vercel AI task
    const sseCancelled = sseRequestManager.cancelTask(taskId);
    const vercelCancelled = cancelVercelAITask(taskId);
    if (sseCancelled || vercelCancelled) {
      log("Processing cancelled for task:", taskId);
    }
  } else if (msg.type === 'get_huntly_shortcuts') {
    // Fetch huntly shortcuts from the server (for content script use)
    fetchEnabledShortcuts()
      .then((shortcuts) => {
        sendResponse({ success: true, shortcuts: shortcuts || [] });
      })
      .catch((error) => {
        console.error('Failed to fetch huntly shortcuts:', error);
        sendResponse({ success: false, shortcuts: [], error: error.message });
      });
    return true; // Keep the message channel open for async response
  } else if (msg.type === 'get_ai_toolbar_data') {
    // Get all AI toolbar data for content script use (shortcuts + models)
    getAIToolbarData()
      .then((data) => {
        sendResponse({ success: true, ...data });
      })
      .catch((error) => {
        console.error('Failed to get AI toolbar data:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  } else if ((msg as any).type === 'open_tab') {
    // Open a new tab (for content script context where chrome.tabs.create is not available)
    const openTabMsg = msg as Message & { url?: string };
    const url = openTabMsg.url || openTabMsg.payload?.url;
    if (url) {
      chrome.tabs.create({ url });
    }
  } else if ((msg as any).type === 'badge_refresh') {
    // Refresh badge for a specific tab after manual save/delete from popup
    const tabId = msg.payload?.tabId;
    const url = msg.payload?.url;
    if (tabId && url) {
      updateBadgeForTab(tabId, url, true);
    } else {
      refreshBadgeForActiveTab();
    }
  } else if ((msg as any).type === 'http_proxy') {
    const { method, baseUrl, url, data } = msg.payload || {};
    if (!baseUrl || !url) {
      sendResponse({ success: false, error: 'Invalid proxy request.' });
      return;
    }

    (async () => {
      try {
        const fullUrl = combineUrl(baseUrl, url);
        const init: RequestInit = {
          method: method || 'GET',
          cache: 'no-cache',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        };
        if (data !== undefined && method !== 'GET' && method !== 'DELETE') {
          init.body = JSON.stringify(data);
        }

        const response = await fetch(fullUrl, init);
        const text = await response.text();
        sendResponse({ success: true, data: text, status: response.status });
      } catch (error) {
        sendResponse({ success: false, error: (error as Error)?.message || 'http_proxy failed' });
      }
    })();
    return true;
  } else if ((msg as any).type === 'save_detail_init') {
    const { data } = msg.payload || {};
    const inputPage = data?.page as PageModel | undefined;
    if (!inputPage?.url) {
      sendResponse({ success: false, error: 'Invalid page data for save detail initialization.' });
      return;
    }

    (async () => {
      try {
        const resp = await saveArticle(inputPage);
        if (!resp) {
          sendResponse({ success: false, error: 'Failed to save page.' });
          return;
        }
        const json = JSON.parse(resp);
        const pageId = json?.data as number;
        if (!pageId || pageId <= 0) {
          sendResponse({ success: false, error: 'Invalid page id from save API.' });
          return;
        }

        const operateResult = await savePageToLibrary(pageId);
        const detail = await getPageDetail(pageId);
        const dbPage = detail?.page || {};
        // Also fetch collection tree for the SaveDetailPanel
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
        sendResponse({ success: false, error: (error as Error)?.message || 'save_detail_init failed' });
      }
    })();
    return true;
  }
});

// Helper function to get all AI toolbar data
async function getAIToolbarData() {
  // Load shortcuts data
  const promptsSettings = await getPromptsSettings();
  const enabledPrompts = promptsSettings.prompts.filter(p => p.enabled);
  const userPrompts = enabledPrompts.filter(p => !p.isSystem);
  const systemPrompts = enabledPrompts.filter(p => p.isSystem);
  const huntlyShortcutsEnabled = promptsSettings.huntlyShortcutsEnabled;

  // Load huntly shortcuts if enabled
  let huntlyShortcuts: any[] = [];
  const baseUrl = await getApiBaseUrl();
  if (baseUrl && huntlyShortcutsEnabled) {
    try {
      huntlyShortcuts = await fetchEnabledShortcuts();
    } catch (error) {
      console.error('Failed to fetch huntly shortcuts:', error);
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
      id: 'huntly-server:default',
      name: 'Huntly AI',
      provider: 'huntly-server',
      providerName: 'Huntly',
    });
  }

  // Add models from enabled providers
  for (const providerType of availableProviders) {
    if (providerType === 'huntly-server') continue;

    const config = storage.providers[providerType];
    if (config?.enabled && config.enabledModels.length > 0) {
      const providerMeta = PROVIDER_REGISTRY[providerType];
      for (const modelId of config.enabledModels) {
        const modelMeta = providerMeta.defaultModels.find(m => m.id === modelId);
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
      defaultModel = modelList.find(m => m.provider === defaultProviderType) || modelList[0];
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
      payload: {id: json.data}
    });
    // Update badge for the active tab after auto-save
    refreshBadgeForActiveTab();
  }
}

/**
 * Refresh the badge for the currently active tab (force re-check)
 */
function refreshBadgeForActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const tab = tabs[0];
    if (tab?.id && tab?.url) {
      updateBadgeForTab(tab.id, tab.url, true);
    }
  });
}

chrome.tabs.onUpdated.addListener(function (tabId: number, changeInfo, tab) {
  if (changeInfo.status == "complete") {
    chrome.tabs.sendMessage<Message>(tabId, {
      type: "tab_complete"
    })

    // Update badge when page finishes loading
    if (tab.url) {
      updateBadgeForTab(tabId, tab.url);
    }
  }

  // Also handle URL changes (SPA navigation) without waiting for "complete"
  if (changeInfo.url) {
    // Clear cache for this tab since URL changed
    badgeCache.delete(tabId);
    updateBadgeForTab(tabId, changeInfo.url);
  }
})

// Listen for tab activation (user switches tabs)
chrome.tabs.onActivated.addListener(function(activeInfo) {
  // Update badge when user switches to a different tab
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (tab.url) {
      updateBadgeForTab(activeInfo.tabId, tab.url);
    }
  });
});

// 监听标签页关闭事件
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  // 取消该标签页的所有处理任务
  const cancelledCount = sseRequestManager.cancelTasksByTabId(tabId);

  if (cancelledCount > 0) {
    log(`Processing cancelled for ${cancelledCount} tasks due to tab ${tabId} close`);
  }

  // Clean up badge cache for this tab
  badgeCache.delete(tabId);
});

// Create context menu for Reading Mode
const CONTEXT_MENU_READING_MODE_PAGE = "huntly_reading_mode_page";
const CONTEXT_MENU_READING_MODE_SELECTION = "huntly_reading_mode_selection";
const CONTEXT_MENU_READING_MODE_ACTION = "huntly_reading_mode_action";

// Add DEV flag to menu title in development mode
const READING_MODE_TITLE = isDebugging ? "Huntly Reading Mode [DEV]" : "Huntly Reading Mode";

chrome.runtime.onInstalled.addListener(() => {
  // Context menu for page (no selection)
  chrome.contextMenus.create({
    id: CONTEXT_MENU_READING_MODE_PAGE,
    title: READING_MODE_TITLE,
    contexts: ["page"],
  });

  // Context menu for selection (snippet mode)
  chrome.contextMenus.create({
    id: CONTEXT_MENU_READING_MODE_SELECTION,
    title: READING_MODE_TITLE,
    contexts: ["selection"],
  });

  // Context menu for extension icon (action)
  chrome.contextMenus.create({
    id: CONTEXT_MENU_READING_MODE_ACTION,
    title: READING_MODE_TITLE,
    contexts: ["action"],
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  const isSelectionMode = info.menuItemId === CONTEXT_MENU_READING_MODE_SELECTION;
  const isReadingModeMenu = info.menuItemId === CONTEXT_MENU_READING_MODE_PAGE ||
                            info.menuItemId === CONTEXT_MENU_READING_MODE_SELECTION ||
                            info.menuItemId === CONTEXT_MENU_READING_MODE_ACTION;

  if (!isReadingModeMenu) return;

  // Get AI toolbar data
  const aiToolbarData = await getAIToolbarData().catch(() => null);

  if (isSelectionMode) {
    // Get selection content from content script and open snippet reading mode
    chrome.tabs.sendMessage(tab.id, { type: 'get_selection' }, (response) => {
      if (chrome.runtime.lastError) {
        log("Failed to get selection:", chrome.runtime.lastError);
        return;
      }

      const page = response?.page;
      if (page) {
        // Open reading mode with snippet
        chrome.tabs.sendMessage(tab.id!, {
          type: 'shortcuts_preview',
          payload: {
            page: page,
            externalShortcuts: aiToolbarData?.externalShortcuts,
            externalModels: aiToolbarData?.externalModels,
          }
        });
      }
    });
  } else {
    // Open full page reading mode
    chrome.tabs.sendMessage(tab.id, {
      type: 'shortcuts_preview',
      payload: {
        page: null, // null means content script will parse the current page
        externalShortcuts: aiToolbarData?.externalShortcuts,
        externalModels: aiToolbarData?.externalModels,
      }
    });
  }
});
