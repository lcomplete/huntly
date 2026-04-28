/**
 * Agent tools for the Huntly AI sidebar.
 *
 * Local tools wrap browser capabilities. Huntly MCP tools are loaded
 * automatically when the user configured a Huntly server and is logged in.
 */

import {
  createMCPClient,
  type MCPClient,
  type MCPClientConfig,
} from "@ai-sdk/mcp";
import { tool } from "ai";
import TurndownService from "turndown";
import { z } from "zod";
import { readSyncStorageSettings } from "../storage";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});
const HUNTLY_MCP_SSE_PATH = "api/mcp/sse";
const MCP_TOOL_TITLE_PREFIX = "MCP";

type AgentToolSet = Record<string, any>;

interface AgentToolContextOptions {
  abortSignal?: AbortSignal;
}

export interface AgentToolMetadata {
  source: "local" | "mcp";
  sourceLabel?: string;
}

const agentToolMetadataByName: Record<string, AgentToolMetadata> = {
  get_page_content: { source: "local" },
  get_page_selection: { source: "local" },
  get_current_time: { source: "local" },
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

function formatUtcOffset(date: Date): string {
  const totalMinutes = -date.getTimezoneOffset();
  const sign = totalMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absoluteMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (absoluteMinutes % 60).toString().padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
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

function createAbortError(signal?: AbortSignal): Error {
  const reason = signal?.reason;
  if (reason instanceof Error) {
    return reason;
  }

  if (typeof DOMException !== "undefined") {
    return new DOMException("The operation was aborted.", "AbortError");
  }

  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError(signal);
  }
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  return (
    Boolean(signal?.aborted) ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function combineAbortSignals(
  first?: AbortSignal | null,
  second?: AbortSignal
): AbortSignal | undefined {
  if (!first) return second;
  if (!second) return first;
  if (first.aborted) return first;
  if (second.aborted) return second;

  const controller = new AbortController();
  const abortFrom = (source: AbortSignal) => {
    if (!controller.signal.aborted) {
      controller.abort(source.reason);
    }
  };

  first.addEventListener("abort", () => abortFrom(first), { once: true });
  second.addEventListener("abort", () => abortFrom(second), { once: true });
  return controller.signal;
}

function createHuntlyMcpFetch(abortSignal?: AbortSignal): typeof fetch {
  return (input, init) => {
    throwIfAborted(abortSignal);
    return HUNTLY_MCP_FETCH(input, {
      ...init,
      signal: combineAbortSignals(init?.signal, abortSignal),
    });
  };
}

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
  abortSignal?: AbortSignal;
}): Promise<void> {
  let client: MCPClient | null = null;
  try {
    throwIfAborted(options.abortSignal);
    client = await createMCPClient({
      transport: options.transport,
      onUncaughtError(error) {
        console.error(
          `[agentTools] Uncaught MCP error from ${options.sourceLabel}`,
          error
        );
      },
    });

    options.clients.push(client);
    const definitions = await client.listTools({
      options: { signal: options.abortSignal },
    });
    throwIfAborted(options.abortSignal);

    const mcpTools = client.toolsFromDefinitions(definitions);
    mergeAgentTools(
      options.tools,
      mcpTools,
      { source: "mcp", sourceLabel: options.sourceLabel },
      options.sourceLabel
    );
  } catch (error) {
    if (client) {
      const clientIndex = options.clients.indexOf(client);
      if (clientIndex !== -1) {
        options.clients.splice(clientIndex, 1);
      }
      await client.close().catch(() => undefined);
    }

    if (isAbortError(error, options.abortSignal)) {
      throw createAbortError(options.abortSignal);
    }

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

export const getCurrentTimeTool = tool({
  description:
    "Get the current local date and time from the user's device, including timezone and UTC offset. Use this when the user asks for the current time, today's date, or needs time-aware reasoning anchored to now.",
  inputSchema: z.object({}),
  async execute() {
    try {
      const now = new Date();
      const timeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const localDateTime = new Intl.DateTimeFormat(undefined, {
        dateStyle: "full",
        timeStyle: "long",
      }).format(now);

      return [
        `**Current local time:** ${localDateTime}`,
        `**ISO 8601:** ${now.toISOString()}`,
        `**Time zone:** ${timeZone}`,
        `**UTC offset:** ${formatUtcOffset(now)}`,
        `**Unix timestamp (ms):** ${now.getTime()}`,
      ].join("\n");
    } catch (err: any) {
      return `Error: ${err.message || "Failed to get current time"}`;
    }
  },
});

// ---------------------------------------------------------------------------
// Local tools and dynamic MCP tool context
// ---------------------------------------------------------------------------

export const LOCAL_AGENT_TOOLS: AgentToolSet = {
  get_page_content: getPageContentTool,
  get_page_selection: getPageSelectionTool,
  get_current_time: getCurrentTimeTool,
};

export async function createAgentToolContext(
  options: AgentToolContextOptions = {}
): Promise<{
  tools: AgentToolSet;
  close: () => Promise<void>;
}> {
  const tools: AgentToolSet = { ...LOCAL_AGENT_TOOLS };
  const clients: MCPClient[] = [];
  const { abortSignal } = options;
  const closeOnAbort = () => {
    void closeMcpClients(clients);
  };
  const removeAbortListener = () => {
    abortSignal?.removeEventListener("abort", closeOnAbort);
  };

  try {
    throwIfAborted(abortSignal);
    abortSignal?.addEventListener("abort", closeOnAbort, { once: true });

    const settings = await readSyncStorageSettings();
    throwIfAborted(abortSignal);
    const huntlyServerUrl = normalizeUrl(settings.serverUrl);

    if (huntlyServerUrl) {
      await loadMcpTools({
        transport: {
          type: "sse",
          url: `${huntlyServerUrl}${HUNTLY_MCP_SSE_PATH}`,
          fetch: createHuntlyMcpFetch(abortSignal),
        },
        sourceLabel: "Huntly server MCP",
        tools,
        clients,
        abortSignal,
      });
    }
  } catch (error) {
    removeAbortListener();
    await closeMcpClients(clients);

    if (isAbortError(error, abortSignal)) {
      throw createAbortError(abortSignal);
    }

    console.error("[agentTools] Failed to prepare agent tools", error);
    return {
      tools: { ...LOCAL_AGENT_TOOLS },
      close: async () => {},
    };
  }

  return {
    tools,
    close: async () => {
      removeAbortListener();
      await closeMcpClients(clients);
    },
  };
}
