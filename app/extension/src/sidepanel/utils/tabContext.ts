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
