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

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Send a message to the active tab's content script and await a response. */
async function sendToActiveTab(message: any): Promise<any> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found");
  return chrome.tabs.sendMessage(tab.id, message);
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

// ---------------------------------------------------------------------------
// All tools as a record (for AI SDK streamText)
// ---------------------------------------------------------------------------

export const ALL_AGENT_TOOLS = {
  get_page_content: getPageContentTool,
  get_page_selection: getPageSelectionTool,
};
