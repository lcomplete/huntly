/**
 * Agent tools for the Huntly AI sidebar.
 *
 * Each tool wraps an existing Huntly extension capability (page content
 * extraction, Huntly API calls, etc.) as an AI SDK tool so the assistant
 * can invoke them autonomously during a conversation.
 */

import { tool } from "ai";
import TurndownService from "turndown";
import { z } from "zod";
import {
  archivePage,
  deletePage,
  getApiBaseUrl,
  getPageDetail,
  readLaterPage,
  removePageFromLibrary,
  saveArticle,
  savePageToLibrary,
  starPage,
  unReadLaterPage,
  unStarPage,
} from "../services";
import { postData } from "../utils";

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Send a message to the active tab's content script and await a response. */
async function sendToActiveTab(message: any): Promise<any> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found");
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id!, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function parseJson(value: string | null | undefined): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractSavedPageId(response: unknown): number {
  if (typeof response === "number") return response;
  if (!response || typeof response !== "object") return 0;

  const data = (response as { data?: unknown }).data;
  return typeof data === "number" ? data : 0;
}

function notifyBadgeRefresh(): void {
  try {
    chrome.runtime.sendMessage({ type: "badge_refresh" });
  } catch {
    // Badge refresh is best-effort.
  }
}

function getPageDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function getActiveParsedPage(): Promise<any> {
  const resp = await sendToActiveTab({ type: "parse_doc" });
  const page = resp?.page;
  if (!page?.url || !page?.content) {
    throw new Error("Could not extract page content.");
  }

  return {
    ...page,
    domain: page.domain || getPageDomain(page.url),
  };
}

function requirePageId(pageId: number | undefined): number {
  if (!pageId || pageId <= 0) {
    throw new Error("pageId is required.");
  }
  return pageId;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const getPageContentTool = tool({
  description:
    "Extract the main article/body content of the current browser tab as markdown text. Returns title, content, URL and metadata. Use this when the user asks about the current page, wants a summary, translation, or any analysis of the page they are viewing.",
  inputSchema: z.object({}),
  async execute() {
    try {
      const resp = await sendToActiveTab({ type: "parse_doc" });
      if (!resp?.page) return "Error: Could not extract page content.";

      const page = resp.page as {
        title?: string;
        content?: string;
        url?: string;
        description?: string;
        author?: string;
        siteName?: string;
      };

      const meta: string[] = [];
      if (page.url) meta.push(`**URL:** ${page.url}`);
      if (page.author) meta.push(`**Author:** ${page.author}`);
      if (page.siteName) meta.push(`**Site:** ${page.siteName}`);
      if (page.description) meta.push(`**Description:** ${page.description}`);

      const parts: string[] = [];
      if (page.title) parts.push(`# ${page.title}`);
      if (meta.length) parts.push(meta.join("  \n"));
      if (page.content) parts.push(`---\n\n${turndown.turndown(page.content)}`);

      return parts.join("\n\n") || "Page content is empty.";
    } catch (err: any) {
      return `Error: ${err.message || "Failed to extract page content"}`;
    }
  },
});

export const getPageSelectionTool = tool({
  description:
    'Get the text currently selected by the user on the active browser tab. Returns the selected HTML content. Use this when the user refers to "selected text", "highlighted text", or "my selection".',
  inputSchema: z.object({}),
  async execute() {
    try {
      const resp = await sendToActiveTab({ type: "get_selection" });
      if (!resp?.page?.content) return "No text is currently selected.";

      const page = resp.page as {
        title?: string;
        content?: string;
        url?: string;
      };
      const parts: string[] = [];
      if (page.title) parts.push(`**Page:** ${page.title}`);
      if (page.content) parts.push(turndown.turndown(page.content));
      return parts.join("\n\n");
    } catch (err: any) {
      return `Error: ${err.message || "Failed to get selection"}`;
    }
  },
});

export const savePageToHuntlyTool = tool({
  description:
    "Save the current browser tab to Huntly and add it to the user's library. Use this when the user asks to save, capture, or add the current page to Huntly.",
  inputSchema: z.object({}),
  async execute() {
    try {
      const page = await getActiveParsedPage();
      const saveResponse = parseJson(await saveArticle(page));
      const pageId = extractSavedPageId(saveResponse);
      if (!pageId) {
        return {
          error: "Failed to save page.",
          response: saveResponse,
        };
      }

      const operateResult = await savePageToLibrary(pageId);
      notifyBadgeRefresh();

      return {
        pageId,
        title: page.title,
        url: page.url,
        operateResult,
      };
    } catch (err: any) {
      return {
        error: err?.message || "Failed to save current page to Huntly.",
      };
    }
  },
});

export const searchHuntlyTool = tool({
  description:
    "Search saved Huntly content by keyword. Returns matching pages with title, URL, metadata, and library state.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Search keywords."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("Maximum number of results to return."),
    queryOptions: z
      .string()
      .optional()
      .describe(
        "Optional Huntly search filters, such as title-only or library filters."
      ),
  }),
  async execute({ query, limit = 5, queryOptions }) {
    try {
      const baseUri = await getApiBaseUrl();
      if (!baseUri) {
        return { error: "Huntly server URL is not configured." };
      }

      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        return { error: "query is required." };
      }

      const response = parseJson(
        await postData(baseUri, "search", {
          q: normalizedQuery,
          size: Math.min(limit, 20),
          queryOptions,
        })
      );
      const items = Array.isArray(response?.items) ? response.items : [];

      return {
        query: normalizedQuery,
        totalHits: response?.totalHits ?? items.length,
        costSeconds: response?.costSeconds,
        results: items.slice(0, limit).map((item: any) => ({
          id: item.id,
          title: item.title,
          url: item.url,
          description: item.description,
          author: item.author,
          siteName: item.siteName,
          domain: item.domain,
          librarySaveStatus: item.librarySaveStatus,
          starred: item.starred,
          readLater: item.readLater,
          markRead: item.markRead,
          recordAt: item.recordAt,
          connectedAt: item.connectedAt,
        })),
      };
    } catch (err: any) {
      return {
        error: err?.message || "Failed to search Huntly.",
      };
    }
  },
});

export const huntlyApiTool = tool({
  description:
    "Perform common Huntly page operations by page id, including star, archive, read-later, delete, and detail lookup.",
  inputSchema: z.object({
    action: z.enum([
      "get_page_detail",
      "star_page",
      "unstar_page",
      "archive_page",
      "save_to_library",
      "remove_from_library",
      "read_later",
      "unread_later",
      "delete_page",
    ]),
    pageId: z.number().int().positive().optional(),
  }),
  async execute({ action, pageId }) {
    try {
      const id = requirePageId(pageId);
      switch (action) {
        case "get_page_detail":
          return await getPageDetail(id);
        case "star_page":
          notifyBadgeRefresh();
          return await starPage(id);
        case "unstar_page":
          notifyBadgeRefresh();
          return await unStarPage(id);
        case "archive_page":
          notifyBadgeRefresh();
          return await archivePage(id);
        case "save_to_library":
          notifyBadgeRefresh();
          return await savePageToLibrary(id);
        case "remove_from_library":
          notifyBadgeRefresh();
          return await removePageFromLibrary(id);
        case "read_later":
          notifyBadgeRefresh();
          return await readLaterPage(id);
        case "unread_later":
          notifyBadgeRefresh();
          return await unReadLaterPage(id);
        case "delete_page":
          await deletePage(id);
          notifyBadgeRefresh();
          return { deleted: true, pageId: id };
      }
    } catch (err: any) {
      return {
        error: err?.message || "Failed to call Huntly API.",
      };
    }
  },
});

// ---------------------------------------------------------------------------
// All tools as a record (for AI SDK streamText)
// ---------------------------------------------------------------------------

export const ALL_AGENT_TOOLS = {
  get_page_content: getPageContentTool,
  get_page_selection: getPageSelectionTool,
  save_page_to_huntly: savePageToHuntlyTool,
  search_huntly: searchHuntlyTool,
  huntly_api: huntlyApiTool,
};
