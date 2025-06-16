import {log} from "./logger";
import {readSyncStorageSettings} from "./storage";
import {autoSaveArticle, processContentWithShortcut, saveArticle, sendData} from "./services";

// 保存当前处理的任务信息
let currentProcessingTask = null;

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
      url: msg.payload.url
    };
    
    // 发送消息显示文章预览
    chrome.tabs.sendMessage(currentProcessingTask.tabId, {type: 'article_preview'}, function(response) {
      // 发送处理开始的消息
      chrome.tabs.sendMessage(currentProcessingTask.tabId, {
        type: 'processing_start',
        payload: {
          title: currentProcessingTask.shortcutName
        }
      });
      
      // 处理文章内容
      processContentWithShortcut(
        currentProcessingTask.content, 
        currentProcessingTask.shortcutId, 
        currentProcessingTask.url
      ).then(result => {
        if (result) {
          const data = JSON.parse(result);
          if (data && data.content) {
            // 发送处理结果到预览页面
            chrome.tabs.sendMessage(currentProcessingTask.tabId, {
              type: 'process_result',
              payload: {
                content: data.content,
                title: currentProcessingTask.shortcutName
              }
            });
          }
        }
      }).catch(error => {
        console.error("Error processing with shortcut:", error);
      }).finally(() => {
        // 处理完成后清空当前任务
        currentProcessingTask = null;
      });
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