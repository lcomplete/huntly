import {getData, postData} from "./utils";
import {log} from "./logger";
import {readSyncStorageSettings} from "./storage";
import {autoSaveArticle, saveArticle, sendData} from "./services";

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