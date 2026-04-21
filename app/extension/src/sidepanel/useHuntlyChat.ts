/**
 * useHuntlyChat — React hook for managing chat with AI SDK's ToolLoopAgent.
 *
 * Uses AI SDK UI's official React chat state with DirectChatTransport for
 * multi-step tool execution, while adapting messages to Huntly's local types.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { Chat, type CreateUIMessage, useChat } from "@ai-sdk/react";
import {
  DirectChatTransport,
  ToolLoopAgent,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  stepCountIs,
  type ChatStatus,
  type ChatTransport,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import type { HuntlyModelInfo, ChatMessage, ChatPart } from "./types";
import { ALL_AGENT_TOOLS } from "./agentTools";

const CHAT_MAX_OUTPUT_TOKENS = 8192;
const ANTHROPIC_THINKING_BUDGET_TOKENS = 4000;

const ATTACHED_PAGE_CONTEXT_RE =
  /^\s*<attached-page-context>\s*([\s\S]*?)\s*<\/attached-page-context>\s*$/i;
const CONTENT_SECTION_RE = /(?:^|\n)\s*Content:\s*\n([\s\S]*)$/i;
const STEP_PLACEHOLDER_ID = "pending-assistant";

const MISSING_MODEL_TRANSPORT: ChatTransport<UIMessage> = {
  async sendMessages(): Promise<ReadableStream<UIMessageChunk>> {
    throw new Error("No AI model is configured.");
  },
  async reconnectToStream(): Promise<null> {
    return null;
  },
};

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
  sendMessage: (text: string, attachments?: ChatPart[]) => boolean;
  regenerate: () => void;
  cancelRun: (options?: { discard?: boolean }) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
}

// ---------------------------------------------------------------------------
// Provider options for thinking/reasoning
// ---------------------------------------------------------------------------

function buildBaseProviderOptions(_provider?: string): ProviderOptions {
  return {
    openai: { systemMessageMode: "system" },
  };
}

function buildThinkingProviderOptions(provider?: string): ProviderOptions {
  const options = buildBaseProviderOptions(provider);

  options.anthropic = {
    thinking: {
      type: "enabled",
      budgetTokens: ANTHROPIC_THINKING_BUDGET_TOKENS,
    },
  };
  options.deepseek = {
    thinking: { type: "enabled" },
  };
  options.google = {
    thinkingConfig: { thinkingLevel: "high", includeThoughts: true },
  };
  options.openai = {
    ...options.openai,
    reasoningEffort: "high",
    reasoningSummary: "auto",
    forceReasoning: true,
  };
  options.groq = {
    reasoningEffort: "high",
  };

  return options;
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

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
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

function parseAttachedPageContext(text: string): ChatPart | null {
  const match = text.match(ATTACHED_PAGE_CONTEXT_RE);
  if (!match) return null;

  const inner = match[1].trim();
  const contentMatch = inner.match(CONTENT_SECTION_RE);
  const header = (contentMatch ? inner.slice(0, contentMatch.index) : inner)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  let title: string | undefined;
  let articleTitle: string | undefined;
  let url: string | undefined;

  for (const line of header) {
    if (line.startsWith("Original page title:")) {
      title = line.replace(/^Original page title:\s*/, "").trim() || undefined;
    } else if (line.startsWith("Parsed article title:")) {
      articleTitle =
        line.replace(/^Parsed article title:\s*/, "").trim() || undefined;
    } else if (line.startsWith("URL:")) {
      url = line.replace(/^URL:\s*/, "").trim() || undefined;
    }
  }

  return {
    type: "page-context",
    title,
    articleTitle,
    url,
    content: contentMatch?.[1]?.trim() || "",
  };
}

function getToolInput(part: ChatPart): unknown {
  if (part.args) return part.args;
  if (part.argsText) return safeParseJson(part.argsText);
  return {};
}

function convertUserChatPartsToUIMessage(
  parts: ChatPart[]
): CreateUIMessage<UIMessage> {
  const uiParts: UIMessage["parts"] = [];

  for (const part of parts) {
    if (part.type === "page-context") {
      uiParts.push({
        type: "text",
        text: formatPageContextForModel(part),
      });
      continue;
    }

    if (part.type === "text" && part.text?.trim()) {
      uiParts.push({ type: "text", text: part.text });
      continue;
    }

    if (part.type === "file" && part.dataUrl && part.mediaType) {
      uiParts.push({
        type: "file",
        url: part.dataUrl,
        mediaType: part.mediaType,
        filename: part.filename,
      });
    }
  }

  return {
    role: "user",
    parts: uiParts,
  };
}

function convertAssistantChatMessageToUIMessage(message: ChatMessage): UIMessage {
  const parts: UIMessage["parts"] = [];

  for (const part of message.parts) {
    switch (part.type) {
      case "step-start":
        parts.push({ type: "step-start" });
        break;

      case "text":
        if (part.text?.trim()) {
          parts.push({
            type: "text",
            text: part.text,
            state: part.streaming ? "streaming" : "done",
          });
        }
        break;

      case "reasoning":
        if (part.text?.trim()) {
          parts.push({
            type: "reasoning",
            text: part.text,
            state: part.streaming ? "streaming" : "done",
          });
        }
        break;

      case "tool-call": {
        if (!part.toolCallId || !part.toolName) break;

        const input = getToolInput(part);
        if (part.result === undefined) {
          parts.push({
            type: "dynamic-tool",
            toolName: part.toolName,
            toolCallId: part.toolCallId,
            state: "input-available",
            input,
          });
          break;
        }

        if (part.isError) {
          parts.push({
            type: "dynamic-tool",
            toolName: part.toolName,
            toolCallId: part.toolCallId,
            state: "output-error",
            input,
            errorText: String(part.result || "Tool execution failed."),
          });
          break;
        }

        parts.push({
          type: "dynamic-tool",
          toolName: part.toolName,
          toolCallId: part.toolCallId,
          state: "output-available",
          input,
          output: part.result,
        });
        break;
      }

      case "file":
        if (part.dataUrl && part.mediaType) {
          parts.push({
            type: "file",
            url: part.dataUrl,
            mediaType: part.mediaType,
            filename: part.filename,
          });
        }
        break;
    }
  }

  return {
    id: message.id,
    role: "assistant",
    parts,
  };
}

function convertChatMessageToUIMessage(message: ChatMessage): UIMessage {
  if (message.role === "user") {
    const userMessage = convertUserChatPartsToUIMessage(message.parts);

    return {
      id: message.id,
      role: "user",
      parts: userMessage.parts,
    };
  }

  return convertAssistantChatMessageToUIMessage(message);
}

function convertChatMessagesToUIMessages(messages: ChatMessage[]): UIMessage[] {
  return messages.map(convertChatMessageToUIMessage);
}

function convertUserUIMessageToChatParts(message: UIMessage): ChatPart[] {
  const result: ChatPart[] = [];

  for (const part of message.parts) {
    if (isTextUIPart(part)) {
      const pageContext = parseAttachedPageContext(part.text);
      if (pageContext) {
        result.push(pageContext);
      } else if (part.text.trim()) {
        result.push({ type: "text", text: part.text });
      }
      continue;
    }

    if (part.type === "file") {
      result.push({
        type: "file",
        filename: part.filename,
        mediaType: part.mediaType,
        dataUrl: part.url,
      });
    }
  }

  return result;
}

function convertAssistantUIMessageToChatParts(message: UIMessage): ChatPart[] {
  return message.parts.reduce<ChatPart[]>((result, part) => {
    if (part.type === "step-start") {
      result.push({ type: "step-start" });
      return result;
    }

    if (isTextUIPart(part)) {
      if (part.text.trim()) {
        result.push({ type: "text", text: part.text });
      }
      return result;
    }

    if (isReasoningUIPart(part)) {
      if (part.text.trim()) {
        result.push({
          type: "reasoning",
          text: part.text,
          streaming: part.state === "streaming",
        });
      }
      return result;
    }

    if (isToolUIPart(part)) {
      const toolName =
        part.type === "dynamic-tool"
          ? part.toolName
          : part.type.slice("tool-".length);

      let toolResult: unknown;
      let isError = false;

      switch (part.state) {
        case "output-available":
          toolResult = part.output;
          break;
        case "output-error":
          toolResult = part.errorText;
          isError = true;
          break;
        case "output-denied":
          toolResult = part.approval.reason || "Tool execution denied.";
          isError = true;
          break;
      }

      result.push({
        type: "tool-call",
        toolCallId: part.toolCallId,
        toolName,
        args: asRecord(part.input),
        argsText: safeStringify(part.input),
        result: toolResult,
        isError,
      });
      return result;
    }

    if (part.type === "file") {
      result.push({
        type: "file",
        filename: part.filename,
        mediaType: part.mediaType,
        dataUrl: part.url,
      });
    }

    return result;
  }, []);
}

function ensureErrorMessage(
  messages: ChatMessage[],
  error: Error | undefined
): ChatMessage[] {
  if (!error) return messages;

  const errorText = `Error: ${error.message || "Unknown error"}`;
  if (messages.length === 0 || messages[messages.length - 1].role !== "assistant") {
    return [
      ...messages,
      {
        id: `error-${generateId()}`,
        role: "assistant",
        parts: [{ type: "text", text: errorText }],
        status: "error",
      },
    ];
  }

  const lastMessage = messages[messages.length - 1];
  const hasErrorText = lastMessage.parts.some(
    (part) => part.type === "text" && part.text === errorText
  );

  if (hasErrorText) return messages;

  return [
    ...messages.slice(0, -1),
    {
      ...lastMessage,
      status: "error",
      parts: [...lastMessage.parts, { type: "text", text: errorText }],
    },
  ];
}

function convertUIMessagesToChatMessages(
  messages: UIMessage[],
  status: ChatStatus,
  error: Error | undefined
): ChatMessage[] {
  const chatMessages = messages.reduce<ChatMessage[]>((result, message, index) => {
    if (message.role === "system") return result;

    const isLast = index === messages.length - 1;
    const isRunning = isLast && (status === "submitted" || status === "streaming");
    const messageStatus: ChatMessage["status"] =
      message.role === "assistant"
        ? isRunning
          ? "running"
          : isLast && status === "error"
          ? "error"
          : "complete"
        : "complete";

    result.push({
      id: message.id,
      role: message.role,
      parts:
        message.role === "assistant"
          ? convertAssistantUIMessageToChatParts(message)
          : convertUserUIMessageToChatParts(message),
      status: messageStatus,
    });

    return result;
  }, []);

  const placeholderMessage: ChatMessage = {
    id: STEP_PLACEHOLDER_ID,
    role: "assistant",
    parts: [],
    status: "running",
  };

  const withPlaceholder =
    (status === "submitted" || status === "streaming") &&
    (chatMessages.length === 0 || chatMessages[chatMessages.length - 1].role !== "assistant")
      ? [...chatMessages, placeholderMessage]
      : chatMessages;

  return status === "error" ? ensureErrorMessage(withPlaceholder, error) : withPlaceholder;
}

// ---------------------------------------------------------------------------
// useHuntlyChat hook
// ---------------------------------------------------------------------------

export function useHuntlyChat(
  options: UseHuntlyChatOptions
): UseHuntlyChatReturn {
  const modelInfo = options.getModelInfo();
  const thinkingEnabled = options.getThinkingMode();
  const uiMessagesRef = useRef<UIMessage[]>([]);
  const [chatGeneration, bumpChatGeneration] = useReducer(
    (value: number) => value + 1,
    0
  );

  const transport = useMemo<ChatTransport<UIMessage>>(() => {
    if (!modelInfo) {
      return MISSING_MODEL_TRANSPORT;
    }

    const agent = new ToolLoopAgent({
      model: modelInfo.model,
      instructions: options.systemPrompt,
      tools: ALL_AGENT_TOOLS,
      stopWhen: stepCountIs(5),
      maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
      providerOptions: thinkingEnabled
        ? buildThinkingProviderOptions(modelInfo.provider)
        : buildBaseProviderOptions(modelInfo.provider),
    });

    return new DirectChatTransport({
      agent,
      sendReasoning: thinkingEnabled,
    });
  }, [modelInfo, options.systemPrompt, thinkingEnabled]);

  const chat = useMemo(
    () =>
      new Chat<UIMessage>({
        messages: uiMessagesRef.current,
        transport,
      }),
    [transport, chatGeneration]
  );

  const {
    messages: uiMessages,
    status,
    error,
    sendMessage: sendUIMessage,
    regenerate: regenerateUIMessage,
    stop,
    setMessages: setUIMessages,
  } = useChat<UIMessage>({ chat });

  useEffect(() => {
    uiMessagesRef.current = uiMessages;
  }, [uiMessages]);

  const messages = useMemo(
    () => convertUIMessagesToChatMessages(uiMessages, status, error),
    [uiMessages, status, error]
  );

  useEffect(() => {
    options.onMessagesChange?.(messages);
  }, [messages, options.onMessagesChange]);

  const isRunning = status === "submitted" || status === "streaming";

  const sendMessage = useCallback(
    (text: string, attachments: ChatPart[] = []) => {
      if (isRunning || !modelInfo) return false;

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
        return false;
      }

      const parts: ChatPart[] = [...pageContextParts];
      if (text.trim()) {
        parts.push({ type: "text", text });
      }
      parts.push(...fileParts);

      void sendUIMessage(convertUserChatPartsToUIMessage(parts));
      return true;
    },
    [isRunning, modelInfo, sendUIMessage]
  );

  const regenerate = useCallback(() => {
    if (isRunning || !modelInfo || uiMessages.length === 0) return;
    void regenerateUIMessage();
  }, [isRunning, modelInfo, regenerateUIMessage, uiMessages.length]);

  const cancelRun = useCallback(
    (runOptions?: { discard?: boolean }) => {
      void stop();
      if (runOptions?.discard) {
        bumpChatGeneration();
      }
    },
    [stop]
  );

  const setMessages = useCallback(
    (nextMessages: ChatMessage[]) => {
      const nextUiMessages = convertChatMessagesToUIMessages(nextMessages);
      uiMessagesRef.current = nextUiMessages;
      setUIMessages(nextUiMessages);
    },
    [setUIMessages]
  );

  const clearMessages = useCallback(() => {
    uiMessagesRef.current = [];
    setUIMessages([]);
  }, [setUIMessages]);

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
