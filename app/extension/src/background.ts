import {log} from "./logger";
import {readSyncStorageSettings, getPromptsSettings} from "./storage";
import {autoSaveArticle, saveArticle, sendData, fetchEnabledShortcuts, fetchGlobalSetting, getApiBaseUrl} from "./services";
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

function startProcessingWithShortcuts(task: any, shortcuts: any[]) {
  if (!task) return;
  
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
    const defaultTargetLanguage = promptsSettings.defaultTargetLanguage || 'Chinese';

    // Build the prompt: replace {lang} placeholder with target language
    const systemPrompt = (shortcutContent || '').replace(/\{lang\}/g, defaultTargetLanguage);

    // Prepare user prompt: content is already markdown (converted in ArticlePreview), add title prefix
    const userPrompt = prepareMarkdownContent(content, title);

    let accumulatedContent = "";

    // Use streamText for streaming response
    const result = await streamText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 8000,
    });

    // Process the stream
    for await (const textPart of result.textStream) {
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

    // Send completion message
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

  } catch (error: any) {
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
    readSyncStorageSettings().then(async (settings) => {
      if (settings.autoSaveTweet) {
        // Fetch minLikes from server's GlobalSetting
        const globalSetting = await fetchGlobalSetting();
        msg.payload.minLikes = globalSetting?.autoSaveTweetMinLikes ?? 0;
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
      startProcessingWithShortcuts(task, shortcuts);
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
    if (sseRequestManager.cancelTask(taskId)) {
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
    })
  }
}

chrome.tabs.onUpdated.addListener(function (tabId: number, changeInfo, tab) {
  if (changeInfo.status == "complete") {
    chrome.tabs.sendMessage<Message>(tabId, {
      type: "tab_complete"
    })
  }
})

// 监听标签页关闭事件
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  // 取消该标签页的所有处理任务
  const cancelledCount = sseRequestManager.cancelTasksByTabId(tabId);
  
  if (cancelledCount > 0) {
    log(`Processing cancelled for ${cancelledCount} tasks due to tab ${tabId} close`);
  }
});