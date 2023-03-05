import {postData} from "./utils";

chrome.runtime.onMessage.addListener(function (msg: Message, sender, sendResponse) {
  if (msg.type === "save_clipper") {
    sendData("page/save", msg.payload);
  } else if (msg.type === 'save_tweets') {
    sendData("tweet/saveTweets", msg.payload);
  } else if (msg.type === 'read_tweet') {
    sendData("tweet/trackRead", msg.payload);
  }
});

function sendData(url, data) {
  chrome.storage.sync.get(
    {
      "serverUrl": "",
    },
    (items) => {
      let serverUrl = items.serverUrl;
      if (serverUrl && serverUrl.startsWith("http")) {
        if (!serverUrl.endsWith("/")) {
          serverUrl = serverUrl + "/"
        }
        const serverBaseUri = serverUrl + "api/";
        postData(serverBaseUri, url, data);
      }
    }
  );
}

chrome.tabs.onUpdated.addListener(function (tabId: number, changeInfo, tab) {
  if (changeInfo.status == "complete") {
    chrome.tabs.sendMessage<Message>(tabId, {
      type: "tab_complete"
    })
  }
})