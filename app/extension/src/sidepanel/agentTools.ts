/**
 * Agent tools for the Huntly AI sidebar.
 *
 * Local tools wrap browser capabilities. Huntly MCP tools are loaded
 * automatically when the user configured a Huntly server and is logged in.
 */

import { createMCPClient, type MCPClient, type MCPClientConfig } from "@ai-sdk/mcp";
import { tool } from "ai";
import TurndownService from "turndown";
import { z } from "zod";
import { readSyncStorageSettings } from "../storage";

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
const HUNTLY_MCP_SSE_PATH = "api/mcp/sse";
const MCP_TOOL_TITLE_PREFIX = "MCP";

type AgentToolSet = Record<string, any>;

export interface AgentToolMetadata {
  source: "local" | "mcp";
  sourceLabel?: string;
}

const agentToolMetadataByName: Record<string, AgentToolMetadata> = {
  get_page_content: { source: "local" },
  get_page_selection: { source: "local" },
};

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

function getPageDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function normalizeUrl(url: string | null | undefined): string {
  const trimmed = url?.trim() || "";
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function registerAgentToolMetadata(
  toolName: string,
  metadata: AgentToolMetadata
): void {
  agentToolMetadataByName[toolName] = metadata;
}

export function getAgentToolMetadata(
  toolName: string | null | undefined
): AgentToolMetadata | undefined {
  if (!toolName) {
    return undefined;
  }

  return agentToolMetadataByName[toolName];
}

export function formatAgentToolTitle(
  metadata: AgentToolMetadata | undefined
): string | undefined {
  if (!metadata || metadata.source !== "mcp") {
    return undefined;
  }

  const sourceLabel = metadata.sourceLabel?.trim();
  return sourceLabel
    ? `${MCP_TOOL_TITLE_PREFIX} · ${sourceLabel}`
    : MCP_TOOL_TITLE_PREFIX;
}

export function parseAgentToolTitle(
  title: string | null | undefined
): AgentToolMetadata | undefined {
  const trimmed = title?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed === MCP_TOOL_TITLE_PREFIX) {
    return { source: "mcp" };
  }

  const prefix = `${MCP_TOOL_TITLE_PREFIX} · `;
  if (!trimmed.startsWith(prefix)) {
    return undefined;
  }

  const sourceLabel = trimmed.slice(prefix.length).trim();
  return {
    source: "mcp",
    sourceLabel: sourceLabel || undefined,
  };
}

const HUNTLY_MCP_FETCH: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    credentials: "include",
  });

function mergeAgentTools(
  target: AgentToolSet,
  incoming: AgentToolSet,
  metadata: AgentToolMetadata,
  sourceLabel: string
): void {
  for (const [toolName, toolDefinition] of Object.entries(incoming)) {
    if (target[toolName]) {
      console.warn(
        `[agentTools] Skipping MCP tool "${toolName}" from ${sourceLabel} because the name is already registered.`
      );
      continue;
    }

    target[toolName] = toolDefinition;
    registerAgentToolMetadata(toolName, metadata);
  }
}

async function closeMcpClients(clients: MCPClient[]): Promise<void> {
  await Promise.allSettled(clients.map((client) => client.close()));
}

async function loadMcpTools(options: {
  transport: MCPClientConfig["transport"];
  sourceLabel: string;
  tools: AgentToolSet;
  clients: MCPClient[];
}): Promise<void> {
  try {
    const client = await createMCPClient({
      transport: options.transport,
      onUncaughtError(error) {
        console.error(
          `[agentTools] Uncaught MCP error from ${options.sourceLabel}`,
          error
        );
      },
    });

    const mcpTools = await client.tools();
    mergeAgentTools(
      options.tools,
      mcpTools,
      { source: "mcp", sourceLabel: options.sourceLabel },
      options.sourceLabel
    );
    options.clients.push(client);
  } catch (error) {
    console.error(
      `[agentTools] Failed to load MCP tools from ${options.sourceLabel}`,
      error
    );
  }
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
// Local tools and dynamic MCP tool context
// ---------------------------------------------------------------------------

export const LOCAL_AGENT_TOOLS: AgentToolSet = {
  get_page_content: getPageContentTool,
  get_page_selection: getPageSelectionTool,
};

export async function createAgentToolContext(): Promise<{
  tools: AgentToolSet;
  close: () => Promise<void>;
}> {
  const tools: AgentToolSet = { ...LOCAL_AGENT_TOOLS };
  const clients: MCPClient[] = [];

  try {
    const settings = await readSyncStorageSettings();
    const huntlyServerUrl = normalizeUrl(settings.serverUrl);

    if (huntlyServerUrl) {
      await loadMcpTools({
        transport: {
          type: "sse",
          url: `${huntlyServerUrl}${HUNTLY_MCP_SSE_PATH}`,
          fetch: HUNTLY_MCP_FETCH,
        },
        sourceLabel: "Huntly server MCP",
        tools,
        clients,
      });
    }
  } catch (error) {
    console.error("[agentTools] Failed to prepare agent tools", error);
    await closeMcpClients(clients);
    return {
      tools: { ...LOCAL_AGENT_TOOLS },
      close: async () => {},
    };
  }

  return {
    tools,
    close: async () => {
      await closeMcpClients(clients);
    },
  };
}
