import {log} from "./logger";
import {readSyncStorageSettings} from "./storage";
import {autoSaveArticle, processContentWithShortcutStream, saveArticle, sendData, fetchEnabledShortcuts} from "./services";

// 保存当前处理的任务信息
let currentProcessingTask = null;

function startProcessingWithShortcuts(shortcuts: any[]) {
  if (!currentProcessingTask) return;
  
  chrome.tabs.sendMessage(currentProcessingTask.tabId, {
    type: 'article_preview',
    payload: {
      shortcuts: shortcuts
    }
  }, function(response) {
    // 发送处理开始的消息
    chrome.tabs.sendMessage(currentProcessingTask.tabId, {
      type: 'processing_start',
      payload: {
        title: currentProcessingTask.shortcutName,
        shortcutName: currentProcessingTask.shortcutName
      }
    });
    
    let accumulatedContent = "";
    
    // 使用流式处理文章内容
    processContentWithShortcutStream(
      currentProcessingTask.content, 
      currentProcessingTask.shortcutId, 
      currentProcessingTask.url,
      currentProcessingTask.title, // 传递文章标题
      // onData callback - 接收流式数据
      (data: string) => {
        if (!currentProcessingTask) return; // 检查任务是否已被取消
        
        accumulatedContent += data;
        // 发送流式数据到预览页面
        try {
          chrome.tabs.sendMessage(currentProcessingTask.tabId, {
            type: 'process_data',
            payload: {
              data: data,
              accumulatedContent: accumulatedContent,
              title: currentProcessingTask.shortcutName
            }
          });
        } catch (error) {
          console.warn("Failed to send process_data message:", error);
          // Tab可能已关闭，取消当前任务
          currentProcessingTask = null;
        }
      },
      // onEnd callback - 处理完成
      () => {
        if (!currentProcessingTask) return; // 检查任务是否已被取消
        
        // 发送处理结果到预览页面
        try {
          chrome.tabs.sendMessage(currentProcessingTask.tabId, {
            type: 'process_result',
            payload: {
              content: accumulatedContent,
              title: currentProcessingTask.shortcutName
            }
          });
        } catch (error) {
          console.warn("Failed to send process_result message:", error);
        } finally {
          // 处理完成后清空当前任务
          currentProcessingTask = null;
        }
      },
      // onError callback - 处理错误
      (error: any) => {
        console.error("Error processing with shortcut:", error);
        
        if (currentProcessingTask) {
          try {
            chrome.tabs.sendMessage(currentProcessingTask.tabId, {
              type: 'process_error',
              payload: {
                error: error.message || 'Processing failed',
                title: currentProcessingTask.shortcutName
              }
            });
          } catch (sendError) {
            console.warn("Failed to send process_error message:", sendError);
          } finally {
            // 处理完成后清空当前任务
            currentProcessingTask = null;
          }
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
        sendData("tweet/saveTweets", msg.payload);
      }
    });
  } else if (msg.type === 'read_tweet') {
    sendData("tweet/trackRead", msg.payload);
  } else if (msg.type === 'process_shortcut') {
    // 保存当前处理任务
    currentProcessingTask = {
      tabId: msg.payload.tabId,
      shortcutId: msg.payload.shortcutId,
      shortcutName: msg.payload.shortcutName,
      content: msg.payload.content,
      url: msg.payload.url,
      title: msg.payload.title || "" // 文章标题
    };
    
    // 获取快捷指令并发送消息显示文章预览
    fetchEnabledShortcuts().then((shortcuts) => {
      startProcessingWithShortcuts(shortcuts);
    }).catch((error) => {
      console.error("Error fetching shortcuts:", error);
      // 即使获取快捷指令失败，也要显示文章预览
      startProcessingWithShortcuts([]);
    });
  } else if (msg.type === 'cancel_processing') {
    // 取消当前处理任务
    currentProcessingTask = null;
    log("Processing cancelled");
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
  // 如果关闭的标签页正在处理快捷指令，取消处理
  if (currentProcessingTask && currentProcessingTask.tabId === tabId) {
    currentProcessingTask = null;
    log("Processing cancelled due to tab close");
  }
});