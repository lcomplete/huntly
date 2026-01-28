import {deleteData, getData, postData} from "./utils";
import {log} from "./logger";
import {PageOperateResult} from "./model/pageOperateResult";

export async function getApiBaseUrl(): Promise<string> {
  const settings = await chrome.storage.sync.get(
    {
      "serverUrl": "",
    });

  let serverUrl = settings.serverUrl;
  if (serverUrl && serverUrl.startsWith("http")) {
    if (!serverUrl.endsWith("/")) {
      serverUrl = serverUrl + "/"
    }
    return serverUrl + "api/";
  }
  return null;
}

export function saveArticle(page: object): Promise<string> {
  return sendData("page/save", page);
}


async function checkInBlacklist(serverBaseUri, url): Promise<boolean> {
  const data = await getData(serverBaseUri, "setting/general/blacklist");
  if (data) {
    const blacklist = data.split("\n");
    for (let i = 0; i < blacklist.length; i++) {
      let regexStr = blacklist[i];
      if (!regexStr.startsWith("^")) {
        regexStr = "^" + regexStr;
      }
      if (!regexStr.endsWith("$")) {
        regexStr = regexStr + "$";
      }
      const regex = new RegExp(regexStr);
      if (regex.test(url)) {
        log("current url is match blacklist regex, do not save", url, blacklist[i]);
        return true;
      }
    }
  }
  return false;
}

export async function sendData(url, data) {
  const baseUri = await getApiBaseUrl();
  return postData(baseUri, url, data);
}

export async function getPageOperateResult(id, url): Promise<string> {
  const baseUri = await getApiBaseUrl();
  return getData(baseUri, "page/pageOperateResult?id=" + (id || 0) + "&url=" + encodeURIComponent(url));
}

export async function autoSaveArticle(data): Promise<string> {
  const baseUri = await getApiBaseUrl();
  const isInBlacklist = await checkInBlacklist(baseUri, data.url);
  if (!isInBlacklist) {
    return postData(baseUri, "page/save", data);
  }
  return null;
}

export async function getLoginUserInfo(): Promise<string> {
  const baseUri = await getApiBaseUrl();
  return getData(baseUri, "auth/loginUserInfo");
}

export async function starPage(pageId): Promise<PageOperateResult> {
  const baseUri = await getApiBaseUrl();
  const resp = await postData(baseUri, "page/star/" + pageId);
  return parsePageOperateResult(resp);
}

export async function unStarPage(pageId): Promise<PageOperateResult> {
  const baseUri = await getApiBaseUrl();
  const resp = await postData(baseUri, "page/unStar/" + pageId);
  return parsePageOperateResult(resp);
}

export async function readLaterPage(pageId): Promise<PageOperateResult> {
  const baseUri = await getApiBaseUrl();
  const resp = await postData(baseUri, "page/readLater/" + pageId);
  return parsePageOperateResult(resp);
}

export async function unReadLaterPage(pageId): Promise<PageOperateResult> {
  const baseUri = await getApiBaseUrl();
  const resp = await postData(baseUri, "page/unReadLater/" + pageId);
  return parsePageOperateResult(resp);
}

export async function archivePage(pageId): Promise<PageOperateResult> {
  const baseUri = await getApiBaseUrl();
  const resp = await postData(baseUri, "page/archive/" + pageId);
  return parsePageOperateResult(resp);
}

export async function savePageToLibrary(pageId): Promise<PageOperateResult> {
  const baseUri = await getApiBaseUrl();
  const resp = await postData(baseUri, "page/saveToLibrary/" + pageId);
  return parsePageOperateResult(resp);
}

export async function removePageFromLibrary(pageId): Promise<PageOperateResult> {
  const baseUri = await getApiBaseUrl();
  const resp = await postData(baseUri, "page/removeFromLibrary/" + pageId);
  return parsePageOperateResult(resp);
}

function parsePageOperateResult(resp){
  if (resp) {
    return JSON.parse(resp);
  }
  return null;
}

export async function deletePage(pageId): Promise<void> {
  const baseUri = await getApiBaseUrl();
  await deleteData(baseUri, "page/" + pageId);
}

/**
 * Fetch enabled article shortcuts from the server
 * @param serverUrl The base URL of the server
 * @returns Promise with the list of enabled shortcuts
 */
export async function fetchEnabledShortcuts(): Promise<any[]> {
  try {
    const baseUri = await getApiBaseUrl();
    const response = await getData(baseUri, "article-shortcuts/enabled");

    if (response) {
      return JSON.parse(response);
    }
    return [];
  } catch (error) {
    console.error("Error fetching shortcuts:", error);
    return [];
  }
}

/**
 * Fetch global setting from the server
 * @returns Promise with the global setting object
 */
export async function fetchGlobalSetting(): Promise<any> {
  try {
    const baseUri = await getApiBaseUrl();
    const response = await getData(baseUri, "setting/general/globalSetting");

    if (response) {
      return JSON.parse(response);
    }
    return null;
  } catch (error) {
    console.error("Error fetching global setting:", error);
    return null;
  }
}
