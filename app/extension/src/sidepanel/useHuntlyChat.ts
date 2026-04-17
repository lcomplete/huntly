/**
 * useHuntlyChat — React hook for managing chat with AI SDK's ToolLoopAgent.
 *
 * Uses ToolLoopAgent for multi-step tool execution with streaming.
 * Manages messages, streaming state, and provides a simple API.
 */

import { useCallback, useRef, useState } from "react";
import { ToolLoopAgent, stepCountIs } from "ai";
import type {
  ContentPart as OutputContentPart,
  FilePart,
  ModelMessage,
  TextPart,
} from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import type { HuntlyModelInfo, ChatMessage, ChatPart } from "./types";
import { ALL_AGENT_TOOLS } from "./agentTools";

// ---------------------------------------------------------------------------
// Hook options
// ---------------------------------------------------------------------------

export interface UseHuntlyChatOptions {
  getModelInfo: () => HuntlyModelInfo | null;
  getThinkingMode: () => boolean;
  systemPrompt: string;
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

export interface UseHuntlyChatReturn {
  messages: ChatMessage[];
  isRunning: boolean;
  sendMessage: (text: string, attachments?: ChatPart[]) => void;
  regenerate: () => void;
  cancelRun: () => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
}

// ---------------------------------------------------------------------------
// Provider options for thinking/reasoning
// ---------------------------------------------------------------------------

function buildBaseProviderOptions(provider?: string): ProviderOptions {
  const options: ProviderOptions = {
    openai: { systemMessageMode: "system" },
  };

  if (provider === "qwen") {
    options.qwen = { enableThinking: false };
  }

  return options;
}

function buildThinkingProviderOptions(provider?: string): ProviderOptions {
  const options = buildBaseProviderOptions(provider);

  options.anthropic = {
    thinking: { type: "enabled", budgetTokens: 10000 },
  };
  options.deepseek = {
    thinking: { type: "enabled" },
  };
  options.google = {
    thinkingConfig: { thinkingLevel: "high", includeThoughts: true },
  };
  if (provider !== "qwen") {
    options.openai = {
      ...options.openai,
      reasoningEffort: "high",
      reasoningSummary: "auto",
      forceReasoning: true,
    };
  }
  options.groq = {
    reasoningEffort: "high",
  };
  if (provider === "qwen") {
    options.qwen = { enableThinking: true };
  }

  return options;
}

// ---------------------------------------------------------------------------
// Convert ChatMessage[] → AI SDK ModelMessage[]
// ---------------------------------------------------------------------------

function convertToModelMessages(chatMessages: ChatMessage[]): ModelMessage[] {
  const result: ModelMessage[] = [];

  for (const msg of chatMessages) {
    switch (msg.role) {
      case "user": {
        const userParts: Array<TextPart | FilePart> = [];

        for (const part of msg.parts) {
          if (part.type === "text" && part.text?.trim()) {
            userParts.push({ type: "text", text: part.text });
          } else if (
            part.type === "page-context" &&
            (part.content?.trim() || part.title || part.url)
          ) {
            userParts.push({
              type: "text",
              text: formatPageContextForModel(part),
            });
          } else if (part.type === "file" && part.dataUrl && part.mediaType) {
            userParts.push({
              type: "file",
              data: part.dataUrl,
              filename: part.filename,
              mediaType: part.mediaType,
            });
          }
        }

        if (userParts.length > 0) {
          result.push({ role: "user", content: userParts });
        }
        break;
      }

      case "assistant": {
        const assistantParts: any[] = [];
        const toolResults: any[] = [];

        for (const p of msg.parts) {
          if (p.type === "text" && p.text?.trim()) {
            assistantParts.push({ type: "text", text: p.text });
          } else if (p.type === "tool-call" && p.toolCallId) {
            assistantParts.push({
              type: "tool-call",
              toolCallId: p.toolCallId,
              toolName: p.toolName!,
              input: p.args || {},
            });
            if (p.result !== undefined) {
              const value =
                typeof p.result === "string"
                  ? p.result
                  : JSON.stringify(p.result ?? "");
              toolResults.push({
                type: "tool-result",
                toolCallId: p.toolCallId,
                toolName: p.toolName!,
                output: p.isError
                  ? { type: "error-text" as const, value }
                  : { type: "text" as const, value },
              });
            }
          }
        }

        if (assistantParts.length > 0) {
          result.push({ role: "assistant", content: assistantParts });
        }
        if (toolResults.length > 0) {
          result.push({ role: "tool", content: toolResults });
        }
        break;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
}

function formatPageContextForModel(part: ChatPart): string {
  const metadata: string[] = [];
  if (part.title) metadata.push(`Original page title: ${part.title}`);
  if (part.articleTitle)
    metadata.push(`Parsed article title: ${part.articleTitle}`);
  if (part.url) metadata.push(`URL: ${part.url}`);

  return [
    "<attached-page-context>",
    "Use this attached page context for current-page requests. Do not call get_page_content for this page unless the user asks to refresh it or inspect a different tab.",
    metadata.join("\n"),
    "Content:",
    part.content?.trim() || "Page content is empty.",
    "</attached-page-context>",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function getAgentToolsForMessages(chatMessages: ChatMessage[]) {
  const latestUserMessage = [...chatMessages]
    .reverse()
    .find((message) => message.role === "user");
  const hasAttachedPageContext = latestUserMessage?.parts.some(
    (part) => part.type === "page-context"
  );

  if (!hasAttachedPageContext) return ALL_AGENT_TOOLS;

  const { get_page_content: _getPageContent, ...toolsWithoutPageContent } =
    ALL_AGENT_TOOLS;
  return toolsWithoutPageContent;
}

// ---------------------------------------------------------------------------
// Extract ChatPart[] from streaming fullStream events
// ---------------------------------------------------------------------------

interface StreamState {
  parts: ChatPart[];
  activeTextParts: Map<string, ChatPart>;
  activeReasoningParts: Map<string, ChatPart>;
  toolCallIndexes: Map<string, number>;
}

function buildPartsFromState(
  state: StreamState,
  includeReasoning: boolean
): ChatPart[] {
  return state.parts.reduce<ChatPart[]>((parts, part) => {
    if (part.type === "reasoning" && (!includeReasoning || !part.text)) {
      return parts;
    }
    if (part.type === "text" && !part.text) return parts;

    parts.push({ ...part });
    return parts;
  }, []);
}

function getOrCreateTextPart(state: StreamState, id: string): ChatPart {
  const existing = state.activeTextParts.get(id);
  if (existing) return existing;

  const part: ChatPart = { id, type: "text", text: "" };
  state.parts.push(part);
  state.activeTextParts.set(id, part);
  return part;
}

function getOrCreateReasoningPart(state: StreamState, id: string): ChatPart {
  const existing = state.activeReasoningParts.get(id);
  if (existing) return existing;

  const part: ChatPart = { id, type: "reasoning", text: "" };
  state.parts.push(part);
  state.activeReasoningParts.set(id, part);
  return part;
}

function appendTextPart(state: StreamState, text: string): void {
  state.parts.push({ id: generateId(), type: "text", text });
}

function upsertToolCallPart(state: StreamState, next: ChatPart): void {
  const toolCallId = next.toolCallId;
  if (!toolCallId) {
    state.parts.push(next);
    return;
  }

  const existingIndex = state.toolCallIndexes.get(toolCallId);
  if (existingIndex !== undefined) {
    state.parts[existingIndex] = {
      ...state.parts[existingIndex],
      ...next,
    };
    return;
  }

  state.toolCallIndexes.set(toolCallId, state.parts.length);
  state.parts.push(next);
}

// ---------------------------------------------------------------------------
// useHuntlyChat hook
// ---------------------------------------------------------------------------

export function useHuntlyChat(
  options: UseHuntlyChatOptions
): UseHuntlyChatReturn {
  const [messages, setMessagesState] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const setMessages = useCallback((msgs: ChatMessage[]) => {
    setMessagesState(msgs);
    optionsRef.current.onMessagesChange?.(msgs);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  const cancelRun = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runAgent = useCallback(
    async (allMessages: ChatMessage[]) => {
      const opts = optionsRef.current;
      const modelInfo = opts.getModelInfo();
      if (!modelInfo) {
        const errorMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "No AI model is configured. Please configure a provider in settings.",
            },
          ],
          status: "error",
        };
        setMessages([...allMessages, errorMsg]);
        return;
      }

      const thinkingEnabled = opts.getThinkingMode();
      const abortController = new AbortController();
      abortRef.current = abortController;
      setIsRunning(true);

      const assistantMsgId = generateId();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        parts: [],
        status: "running",
      };
      setMessages([...allMessages, assistantMsg]);

      const state: StreamState = {
        parts: [],
        activeTextParts: new Map(),
        activeReasoningParts: new Map(),
        toolCallIndexes: new Map(),
      };

      try {
        const modelMessages = convertToModelMessages(allMessages);

        const agent = new ToolLoopAgent({
          model: modelInfo.model,
          instructions: opts.systemPrompt,
          tools: getAgentToolsForMessages(allMessages),
          stopWhen: stepCountIs(5),
          providerOptions: thinkingEnabled
            ? buildThinkingProviderOptions(modelInfo.provider)
            : buildBaseProviderOptions(modelInfo.provider),
        });

        const result = await agent.stream({
          messages: modelMessages,
          abortSignal: abortController.signal,
        });

        let lastSerialized = "";

        const yieldUpdate = () => {
          const parts = buildPartsFromState(state, thinkingEnabled);
          const serialized = safeStringify(parts);
          if (serialized !== lastSerialized) {
            lastSerialized = serialized;
            const updated: ChatMessage = {
              id: assistantMsgId,
              role: "assistant",
              parts,
              status: "running",
            };
            setMessages([...allMessages, updated]);
          }
        };

        for await (const part of result.fullStream) {
          switch (part.type) {
            case "text-start":
              getOrCreateTextPart(state, part.id);
              yieldUpdate();
              break;

            case "text-delta":
              getOrCreateTextPart(state, part.id).text += part.text;
              yieldUpdate();
              break;

            case "text-end":
              state.activeTextParts.delete(part.id);
              yieldUpdate();
              break;

            case "reasoning-start":
              if (thinkingEnabled) {
                getOrCreateReasoningPart(state, part.id);
                yieldUpdate();
              }
              break;

            case "reasoning-delta":
              if (thinkingEnabled) {
                getOrCreateReasoningPart(state, part.id).text += part.text;
                yieldUpdate();
              }
              break;

            case "reasoning-end":
              if (thinkingEnabled) {
                state.activeReasoningParts.delete(part.id);
                yieldUpdate();
              }
              break;

            case "tool-call":
              upsertToolCallPart(state, {
                type: "tool-call",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.input as Record<string, unknown>,
                argsText: safeStringify(part.input),
              });
              yieldUpdate();
              break;

            case "tool-result": {
              upsertToolCallPart(state, {
                type: "tool-call",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.input as Record<string, unknown>,
                argsText: safeStringify(part.input),
                result:
                  typeof part.output === "string"
                    ? part.output
                    : safeStringify(part.output),
              });
              yieldUpdate();
              break;
            }

            case "tool-error": {
              upsertToolCallPart(state, {
                type: "tool-call",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.input as Record<string, unknown>,
                argsText: safeStringify(part.input),
                result: String(part.error),
                isError: true,
              });
              yieldUpdate();
              break;
            }

            case "error":
              appendTextPart(
                state,
                `Error: ${
                  part.error instanceof Error
                    ? part.error.message
                    : String(part.error)
                }`
              );
              yieldUpdate();
              break;
          }
        }

        let finalParts = buildPartsFromState(state, thinkingEnabled);
        if (finalParts.length === 0) {
          try {
            finalParts = convertContentParts(
              await result.content,
              thinkingEnabled
            );
          } catch {
            finalParts = [];
          }
        }

        if (finalParts.length === 0) {
          finalParts = [{ type: "text", text: "" }];
        }

        const finalAssistant: ChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          parts: finalParts,
          status: "complete",
        };
        setMessages([...allMessages, finalAssistant]);
      } catch (error: any) {
        if (error?.name === "AbortError") {
          const abortParts = buildPartsFromState(state, thinkingEnabled);
          if (abortParts.length === 0) {
            abortParts.push({ type: "text", text: "" });
          }
          const abortedAssistant: ChatMessage = {
            id: assistantMsgId,
            role: "assistant",
            parts: abortParts,
            status: "complete",
          };
          setMessages([...allMessages, abortedAssistant]);
          setIsRunning(false);
          abortRef.current = null;
          return;
        }
        const errorParts = buildPartsFromState(state, thinkingEnabled);
        errorParts.push({
          type: "text",
          text: `Error: ${error?.message || "Unknown error"}`,
        });
        const errorAssistant: ChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          parts: errorParts,
          status: "error",
        };
        setMessages([...allMessages, errorAssistant]);
      } finally {
        setIsRunning(false);
        abortRef.current = null;
      }
    },
    [setMessages]
  );

  const sendMessage = useCallback(
    (text: string, attachments: ChatPart[] = []) => {
      const pageContextParts = attachments.filter(
        (part) =>
          part.type === "page-context" &&
          (part.content?.trim() || part.title || part.url)
      );
      const fileParts = attachments.filter(
        (part) => part.type === "file" && part.dataUrl && part.mediaType
      );
      if (
        !text.trim() &&
        pageContextParts.length === 0 &&
        fileParts.length === 0
      ) {
        return;
      }

      const parts: ChatPart[] = [...pageContextParts];
      if (text.trim()) {
        parts.push({ type: "text", text });
      }
      parts.push(...fileParts);

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        parts,
        status: "complete",
      };

      const allMessages = [...messages, userMsg];
      setMessagesState(allMessages);
      runAgent(allMessages);
    },
    [messages, runAgent]
  );

  const regenerate = useCallback(() => {
    if (messages.length === 0) return;

    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;

    const truncated = messages.slice(0, lastUserIdx + 1);
    runAgent(truncated);
  }, [messages, runAgent]);

  return {
    messages,
    isRunning,
    sendMessage,
    regenerate,
    cancelRun,
    setMessages,
    clearMessages,
  };
}

// ---------------------------------------------------------------------------
// Convert final ContentPart[] to ChatPart[]
// ---------------------------------------------------------------------------

function convertContentParts(
  parts: readonly OutputContentPart<any>[],
  includeReasoning: boolean
): ChatPart[] {
  const result: ChatPart[] = [];
  const toolCallIndexes = new Map<string, number>();
  const upsertToolPart = (next: ChatPart) => {
    const toolCallId = next.toolCallId;
    if (!toolCallId) {
      result.push(next);
      return;
    }

    const existingIndex = toolCallIndexes.get(toolCallId);
    if (existingIndex !== undefined) {
      result[existingIndex] = {
        ...result[existingIndex],
        ...next,
      };
      return;
    }

    toolCallIndexes.set(toolCallId, result.length);
    result.push(next);
  };

  for (const part of parts) {
    switch (part.type) {
      case "text":
        if (part.text.trim()) {
          result.push({ type: "text", text: part.text });
        }
        break;

      case "reasoning":
        if (includeReasoning && part.text.trim()) {
          result.push({ type: "reasoning", text: part.text });
        }
        break;

      case "tool-call":
        upsertToolPart({
          type: "tool-call",
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args: part.input as Record<string, unknown>,
          argsText: safeStringify(part.input),
        });
        break;

      case "tool-result":
        upsertToolPart({
          type: "tool-call",
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args: part.input as Record<string, unknown>,
          argsText: safeStringify(part.input),
          result:
            typeof part.output === "string"
              ? part.output
              : safeStringify(part.output),
        });
        break;

      case "tool-error":
        upsertToolPart({
          type: "tool-call",
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args: part.input as Record<string, unknown>,
          argsText: safeStringify(part.input),
          result: String(part.error),
          isError: true,
        });
        break;
    }
  }

  return result;
}
