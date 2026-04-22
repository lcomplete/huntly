import TurndownService from "turndown";
import type { ChatPart } from "../types";
import { readFileAsDataUrl } from "./dom";
import { generateId } from "./ids";

export type TabContext = { title: string; url: string; faviconUrl?: string };

export interface ParsedPageContext {
  title?: string;
  content?: string;
  url?: string;
  faviconUrl?: string;
  description?: string;
  author?: string;
  siteName?: string;
}

const pageContextTurndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

export async function getTabContext(): Promise<TabContext | null> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.title && tab?.url) {
      return { title: tab.title, url: tab.url, faviconUrl: tab.favIconUrl };
    }
  } catch {
    // Ignore tabs permission failures in restricted pages.
  }
  return null;
}

function sendMessageToTab(tabId: number, message: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function sendRuntimeMessage(message: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function buildPageContextMarkdown(page: ParsedPageContext): string {
  const meta: string[] = [];
  if (page.url) meta.push(`**URL:** ${page.url}`);
  if (page.author) meta.push(`**Author:** ${page.author}`);
  if (page.siteName) meta.push(`**Site:** ${page.siteName}`);
  if (page.description) meta.push(`**Description:** ${page.description}`);

  const parts: string[] = [];
  if (page.title) parts.push(`# ${page.title}`);
  if (meta.length) parts.push(meta.join("  \n"));
  if (page.content) {
    parts.push(`---\n\n${pageContextTurndown.turndown(page.content)}`);
  }

  return parts.join("\n\n");
}

export async function createCurrentPageContextPart(): Promise<ChatPart> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id || !tab.url) {
    throw new Error("No active tab found.");
  }

  const response = await sendMessageToTab(tab.id, { type: "parse_doc" });
  const page = response?.page as ParsedPageContext | undefined;
  if (!page?.content) {
    throw new Error("Could not extract page content.");
  }

  const tabTitle = tab.title || page.title || "Current tab";
  const articleTitle = page.title;
  const pageContext: ParsedPageContext = {
    ...page,
    title: articleTitle || tabTitle,
    url: page.url || tab.url,
    faviconUrl: page.faviconUrl || tab.favIconUrl,
  };

  return {
    id: generateId(),
    type: "page-context",
    title: tabTitle,
    articleTitle,
    url: pageContext.url,
    faviconUrl: pageContext.faviconUrl,
    content: buildPageContextMarkdown(pageContext),
    description: pageContext.description,
    author: pageContext.author,
    siteName: pageContext.siteName,
  };
}

export function pageContextToTabContext(
  part: ChatPart | null
): TabContext | null {
  if (part?.type !== "page-context") return null;
  if (!part.title && !part.url) return null;
  return {
    title: part.title || "Current tab",
    url: part.url || "",
    faviconUrl: part.faviconUrl,
  };
}

export function clonePageContextPart(part: ChatPart): ChatPart {
  return { ...part, id: generateId() };
}

export async function createAttachmentPart(file: File): Promise<ChatPart> {
  return {
    id: generateId(),
    type: "file",
    filename: file.name,
    mediaType: file.type || "application/octet-stream",
    size: file.size,
    dataUrl: await readFileAsDataUrl(file),
  };
}

function estimateDataUrlSize(encoded: string, isBase64: boolean): number | undefined {
  if (!encoded) return 0;

  if (isBase64) {
    const normalized = encoded.replace(/\s/g, "");
    const padding = normalized.endsWith("==")
      ? 2
      : normalized.endsWith("=")
      ? 1
      : 0;
    return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
  }

  try {
    return new TextEncoder().encode(decodeURIComponent(encoded)).length;
  } catch {
    return undefined;
  }
}

function parseImageDataUrl(dataUrl: string): {
  mediaType: string;
  size?: number;
} {
  if (!dataUrl.startsWith("data:")) {
    throw new Error("Dropped data is not a valid image data URL");
  }

  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    throw new Error("Dropped data is not a valid image payload");
  }

  const metadata = dataUrl.slice(5, commaIndex);
  const mediaType = metadata.split(";")[0] || "";
  if (!mediaType.startsWith("image/")) {
    throw new Error("Dropped data is not an image");
  }

  return {
    mediaType,
    size: estimateDataUrlSize(
      dataUrl.slice(commaIndex + 1),
      metadata.includes(";base64")
    ),
  };
}

function inferFilenameFromUrl(url: string, fallbackExt: string): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop() || "";
    if (last && /\.[a-z0-9]+$/i.test(last)) return decodeURIComponent(last);
    if (last) return `${decodeURIComponent(last)}.${fallbackExt}`;
  } catch {
    // ignore
  }
  return `image-${Date.now()}.${fallbackExt}`;
}

function inferFilenameFromMediaType(mediaType: string, prefix = "image"): string {
  const extension = mediaType.split("/")[1]?.split(/[+;]/)[0] || "bin";
  return `${prefix}-${Date.now()}.${extension}`;
}

async function fetchDroppedImageDataUrl(url: string): Promise<string> {
  if (/^data:image\//i.test(url)) {
    return url;
  }

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (tab?.id) {
    try {
      const response = await sendMessageToTab(tab.id, {
        type: "fetch_image",
        payload: { url },
      });

      if (response?.success && response.dataUrl) {
        return response.dataUrl;
      }
    } catch {
      // Fall back to background fetch for standard URLs.
    }
  }

  if (url.startsWith("blob:")) {
    throw new Error("Failed to fetch blob image from the current tab");
  }

  const response = await sendRuntimeMessage({
    type: "fetch_image",
    payload: { url },
  });

  if (!response?.success || !response.dataUrl) {
    throw new Error(response?.error || "Failed to fetch image");
  }

  return response.dataUrl;
}

export async function createAttachmentPartFromDataUrl(
  dataUrl: string,
  filename?: string
): Promise<ChatPart> {
  const { mediaType, size } = parseImageDataUrl(dataUrl);

  return {
    id: generateId(),
    type: "file",
    filename: filename || inferFilenameFromMediaType(mediaType),
    mediaType,
    size,
    dataUrl,
  };
}

export async function createAttachmentPartFromUrl(
  url: string
): Promise<ChatPart> {
  const dataUrl = await fetchDroppedImageDataUrl(url);
  const filename = url.startsWith("http://") || url.startsWith("https://")
    ? inferFilenameFromUrl(url, "png")
    : undefined;
  return createAttachmentPartFromDataUrl(dataUrl, filename);
}

export async function getDraggedImageSource(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id) {
    return null;
  }

  try {
    const response = await sendMessageToTab(tab.id, {
      type: "get_dragged_image",
    });

    return response?.success && typeof response.url === "string"
      ? response.url
      : null;
  } catch {
    return null;
  }
}

export async function clearDraggedImageSource(): Promise<void> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id) {
    return;
  }

  try {
    await sendMessageToTab(tab.id, {
      type: "clear_dragged_image",
    });
  } catch {
    // Ignore transient tab messaging failures.
  }
}

export function onConfigChange(callback: () => void): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName !== "sync") return;
    const relevantKeys = [
      "aiProviders",
      "userPrompts",
      "enabledSystemPrompts",
      "defaultTargetLanguage",
    ];
    if (relevantKeys.some((key) => key in changes)) {
      callback();
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
