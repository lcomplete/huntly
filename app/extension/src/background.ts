import {getData, postData} from "./utils";
import {log} from "./logger";

chrome.runtime.onMessage.addListener(function (msg: Message, sender, sendResponse) {
  if (msg.type === "auto_save_clipper") {
    autoSaveArticle("page/save", msg.payload, sender);
  } else if (msg.type === "save_clipper") {
    sendData("page/save", msg.payload);
  } else if (msg.type === 'save_tweets') {
    sendData("tweet/saveTweets", msg.payload);
  } else if (msg.type === 'read_tweet') {
    sendData("tweet/trackRead", msg.payload);
  }
});

function getServerUrl(callback) {
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
        callback(serverBaseUri);
      }
    }
  );
}

function checkBlacklist(serverBaseUri, sender, thenDo) {
  getData(serverBaseUri, "setting/general/globalSetting").then((data) => {
    const jsonData = JSON.parse(data);
    const blacklist = jsonData.autoSaveSiteBlacklists != null ? jsonData.autoSaveSiteBlacklists.split("\n") : [];
    // if current url is match blacklist regex, do not save
    for (let i = 0; i < blacklist.length; i++) {
      let regexStr = blacklist[i];
      if (!regexStr.startsWith("^")) {
        regexStr = "^" + regexStr;
      }
      if (!regexStr.endsWith("$")) {
        regexStr = regexStr + "$";
      }
      const regex = new RegExp(regexStr);
      if (regex.test(sender.url)) {
        log("current url is match blacklist regex, do not save", sender.url, blacklist[i]);
        return;
      }

      thenDo();
    }
  });
}

function sendData(url, data) {
  getServerUrl((serverBaseUri) => {
    postData(serverBaseUri, url, data).then(r => {
      log("save success", r);
    });
  })
}

function autoSaveArticle(url, data, sender) {
  getServerUrl((serverBaseUri) => {
    checkBlacklist(serverBaseUri, sender, () => {
      postData(serverBaseUri, url, data).then(r => {
        log("save success", r);
      });
    });
  })
}

chrome.tabs.onUpdated.addListener(function (tabId: number, changeInfo, tab) {
  if (changeInfo.status == "complete") {
    chrome.tabs.sendMessage<Message>(tabId, {
      type: "tab_complete"
    })
  }
})