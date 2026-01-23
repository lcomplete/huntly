import {log} from "./logger";
import {readSyncStorageSettings} from "./storage";
import {autoSaveArticle, saveArticle, sendData} from "./services";
import {sseRequestManager} from "./sseTaskManager";

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

chrome.runtime.onMessage.addListener(function (msg: Message, sender, sendResponse) {
  if (msg.type === "auto_save_clipper") {
    autoSaveArticle(msg.payload).then(handleSaveArticleResponse);
  } else if (msg.type === "save_clipper") {
    saveArticle(msg.payload);
  } else if (msg.type === 'auto_save_tweets') {
    readSyncStorageSettings().then((settings) => {
      if (settings.autoSaveTweet) {
        // Add minLikes to payload
        msg.payload.minLikes = settings.autoSaveTweetMinLikes;
        sendData("tweet/saveTweets", msg.payload);
      }
    });
  } else if (msg.type === 'read_tweet') {
    sendData("tweet/trackRead", msg.payload);
  } else if (msg.type === 'shortcuts_process') {
    const task = {
      tabId: msg.payload.tabId || sender.tab?.id,
      taskId: msg.payload.taskId,
      shortcutId: msg.payload.shortcutId,
      shortcutName: msg.payload.shortcutName,
      content: msg.payload.content,
      url: msg.payload.url,
      title: msg.payload.title || "", // 文章标题
      contentType: msg.payload.contentType, // Pass contentType for snippet mode
    };
    
    // 使用 payload 中传递的 shortcuts 数据
    const shortcuts = msg.payload.shortcuts || [];
    startProcessingWithShortcuts(task, shortcuts);
  } else if (msg.type === 'shortcuts_cancel') {
    // 根据 taskId 取消处理任务
    const taskId = msg.payload.taskId;
    if (sseRequestManager.cancelTask(taskId)) {
      log("Processing cancelled for task:", taskId);
    }
  }
});

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