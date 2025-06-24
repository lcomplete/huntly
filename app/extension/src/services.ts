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

  const abortController = new AbortController();
  
  // Safety mechanism: force timeout after 5 minutes
  const timeoutId = setTimeout(() => {
    console.warn('[SSE] Force timeout after 5 minutes');
    abortController.abort();
    onError(new Error("Request timeout"));
  }, 5 * 60 * 1000);
  
  const cleanup = () => {
    clearTimeout(timeoutId);
    try {
      abortController.abort();
    } catch (e) {
      // Ignore abort errors
    }
  };
  
  try {
    console.debug('[SSE] Starting streaming request for shortcut:', shortcutId);
    
    const response = await fetch(`${apiBaseUri}page/processContentWithShortcut`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        content,
        shortcutId,
        baseUri,
        title,
        mode: 'fast'
      }),
      signal: abortController.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body available");
    }

    await processStreamResponse(response.body, onData, onEnd, onError);
    
  } catch (error) {
    console.error('[SSE] Error in streaming request:', error);
    onError(error);
  } finally {
    cleanup();
  }
}

async function processStreamResponse(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void,
  onEnd: () => void,
  onError: (error: any) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let iterations = 0;
  const maxIterations = 200000; // 20万次迭代限制
  const maxBufferSize = 10 * 1024 * 1024; // 10MB 缓冲区限制

  try {
    while (true) {
      // Safety checks
      if (++iterations > maxIterations) {
        throw new Error("Maximum iterations exceeded - potential infinite loop");
      }
      
      if (buffer.length > maxBufferSize) {
        throw new Error("Buffer size exceeded - potential memory leak");
      }
      
      const { done, value } = await reader.read();
      
      if (done) {
        console.debug('[SSE] Stream completed');
        onEnd();
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      buffer = processSSELines(buffer, onData, onError);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch (e) {
      console.warn('[SSE] Error releasing reader lock:', e);
    }
  }
}

function processSSELines(
  buffer: string,
  onData: (data: string) => void,
  onError: (error: any) => void
): string {
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
    // Extract complete line (without the \n)
    let line = buffer.slice(0, newlineIndex);
    // Handle \r\n line endings
    if (line.endsWith('\r')) {
      line = line.slice(0, -1);
    }
    // Remove processed line from buffer
    buffer = buffer.slice(newlineIndex + 1);
    
    // Process the complete line
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Handle SSE format: "data: <content>" or "data:<content>"
    if (trimmedLine.startsWith('data:')) {
      const data = trimmedLine.startsWith('data: ') 
        ? trimmedLine.slice(6)  // Remove 'data: ' prefix (with space)
        : trimmedLine.slice(5); // Remove 'data:' prefix (no space)
      
      // Process the data (fast mode)
      if (data.trim()) {
        try {
          // Try to parse as JSON first (for fast mode)
          const parsedData = JSON.parse(data);
          if (typeof parsedData === 'string') {
            // Fast mode returns string content
            onData(parsedData);
          } else {
            // Other formats, pass raw data
            onData(data);
          }
        } catch (e) {
          // Not JSON, pass raw data
          onData(data);
        }
      }
    }
    // Handle error events
    else if (trimmedLine.startsWith('event: error')) {
      console.error('[SSE] Server sent error event');
      onError(new Error("Server processing error"));
      return buffer; // Stop processing
    }
  }
  
  return buffer; // Return remaining incomplete lines
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
