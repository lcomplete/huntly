import {deleteData, getData, postData} from "./utils";
import {log} from "./logger";
import {PageOperateResult} from "./model/pageOperateResult";

async function getApiBaseUrl(): Promise<string> {
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

/**
 * Process article content with a shortcut using streaming response
 * @param content The article content to process
 * @param shortcutId The ID of the shortcut to use
 * @param baseUri Optional base URI for HTML cleaning
 * @param title Optional title to include in the processing
 * @param onData Callback function to handle streaming data
 * @param onEnd Callback function to handle completion
 * @param onError Callback function to handle errors
 */
export async function processContentWithShortcutStream(
  content: string,
  shortcutId: number,
  baseUri: string = "",
  title: string = "",
  onData: (data: string) => void,
  onEnd: () => void,
  onError: (error: any) => void
): Promise<void> {
  const apiBaseUri = await getApiBaseUrl();
  if (!apiBaseUri) {
    onError(new Error("API base URL not configured"));
    return;
  }

  try {
    console.debug('[SSE] Starting streaming request for shortcut:', shortcutId);
    
    const response = await fetch(`${apiBaseUri}page/processContentWithShortcut`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        content,
        shortcutId,
        baseUri,
        title,
        mode: 'fast'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("No response body reader available");
    }

    // Set up timeout to prevent hanging requests
    const timeoutId = setTimeout(() => {
      reader.cancel();
      onError(new Error("Request timeout"));
    }, 300000); // 5 minutes timeout

    let buffer = '';

    const processDataLine = (dataContent: string) => {
      if (dataContent.trim()) {
        try {
          // 尝试解析JSON格式的内容
          const parsedData = JSON.parse(dataContent);
          // 如果是字符串，说明是fast模式下的文本内容
          if (typeof parsedData === 'string') {
            console.debug('[SSE] Received text content:', parsedData.slice(0, 100));
            onData(parsedData);
          } else {
            // 如果不是字符串，可能是其他格式的数据，直接传递
            console.debug('[SSE] Received non-string data:', dataContent.slice(0, 100));
            onData(dataContent);
          }
        } catch (e) {
          // 解析JSON失败，说明不是JSON格式，直接传递原始数据
          console.debug('[SSE] JSON parse failed, using raw data:', dataContent.slice(0, 100));
          onData(dataContent);
        }
      }
    };

    // Process stream
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Process any remaining data in buffer
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              processDataLine(data);
            }
          }
        }
        clearTimeout(timeoutId);
        console.debug('[SSE] Stream completed successfully');
        onEnd();
        break;
      }

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      // Process each complete line
      for (const line of lines) {
        if (line.trim() === '') continue; // Skip empty lines
        
        if (line.startsWith('data: ')) {
          const data = line.slice(6); // Remove 'data: ' prefix
          processDataLine(data);
        } else if (line.startsWith('event: error')) {
          // Handle error events
          clearTimeout(timeoutId);
          onError(new Error("Server sent error event"));
          return;
        }
      }
    }
  } catch (error) {
    console.error('[SSE] Error in streaming request:', error);
    onError(error);
  }
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
