/**
 * useHuntlyChat — React hook for managing chat with AI SDK's ToolLoopAgent.
 *
 * Uses AI SDK UI's official React chat state with a local chat transport for
 * multi-step tool execution, while adapting messages to Huntly's local types.
 *
 * Multiple parallel sessions are coordinated via `SessionChatPool` in
 * `./chatPool`. This hook binds the React UI state to an externally-created
 * `Chat` instance representing the active session.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Chat, type CreateUIMessage, useChat } from "@ai-sdk/react";
import {
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type ChatStatus,
  type ChatTransport,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import type { ChatMessage, ChatPart } from "./types";

export const CHAT_MAX_OUTPUT_TOKENS = 8192;
const ANTHROPIC_THINKING_BUDGET_TOKENS = 4000;

const ATTACHED_PAGE_CONTEXT_RE =
  /^\s*<attached-page-context>\s*([\s\S]*?)\s*<\/attached-page-context>\s*$/i;
const CONTENT_SECTION_RE = /(?:^|\n)\s*Content:\s*\n([\s\S]*)$/i;
const STEP_PLACEHOLDER_ID = "pending-assistant";
const INLINE_FILE_DATA_PART_TYPE = "data-huntly-inline-file";

export type HuntlyUIMessageMetadata = {
  createdAt?: string;
};

export type HuntlyUIMessage = UIMessage<HuntlyUIMessageMetadata>;

export type InlineFileDataPart = {
  type: typeof INLINE_FILE_DATA_PART_TYPE;
  data: {
    dataUrl: string;
    mediaType: string;
    filename?: string;
  };
};

export const MISSING_MODEL_TRANSPORT: ChatTransport<HuntlyUIMessage> = {
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
  /**
   * Active session Chat instance produced by `SessionChatPool`. When null
   * (e.g. no model configured or no session selected), the hook returns a
   * no-op API.
   */
  chat: Chat<HuntlyUIMessage> | null;
  hasModel: boolean;
}

export interface UseHuntlyChatReturn {
  messages: ChatMessage[];
  isRunning: boolean;
  sendMessage: (text: string, attachments?: ChatPart[]) => boolean;
  regenerate: (messageId?: string) => void;
  cancelRun: () => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
}

// ---------------------------------------------------------------------------
// Provider options for thinking/reasoning
// ---------------------------------------------------------------------------

export function buildBaseProviderOptions(
  _provider?: string
): ProviderOptions {
  return {
    openai: { systemMessageMode: "system" },
  };
}

export function buildThinkingProviderOptions(
  provider?: string
): ProviderOptions {
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

function dataUrlToBase64(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Invalid data URL format");
  }

  return dataUrl.slice(commaIndex + 1);
}

function inlineFilePartToDataPart(
  part: Extract<UIMessage["parts"][number], { type: "file" }>
): InlineFileDataPart | Extract<UIMessage["parts"][number], { type: "file" }> {
  if (!part.url.startsWith("data:")) {
    return part;
  }

  return {
    type: INLINE_FILE_DATA_PART_TYPE,
    data: {
      dataUrl: part.url,
      mediaType: part.mediaType,
      filename: part.filename,
    },
  };
}

export function replaceInlineFileParts(
  messages: HuntlyUIMessage[]
): HuntlyUIMessage[] {
  return messages.map((message) => {
    if (message.role !== "user") {
      return message;
    }

    return {
      ...message,
      parts: message.parts.map((part) =>
        part.type === "file" ? inlineFilePartToDataPart(part) : part
      ),
    };
  });
}

export function convertInlineFileDataPart(part: { type: string; data: unknown }) {
  if (part.type !== INLINE_FILE_DATA_PART_TYPE) {
    return undefined;
  }

  const payload = part.data as InlineFileDataPart["data"];
  if (!payload?.dataUrl || !payload.mediaType) {
    return undefined;
  }

  return {
    type: "file" as const,
    mediaType: payload.mediaType,
    filename: payload.filename,
    data: dataUrlToBase64(payload.dataUrl),
  };
}

export function convertUserChatPartsToUIMessage(
  parts: ChatPart[],
  createdAt = new Date().toISOString()
): CreateUIMessage<HuntlyUIMessage> {
  const uiParts: HuntlyUIMessage["parts"] = [];

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
    metadata: { createdAt },
  };
}

function convertAssistantChatMessageToUIMessage(
  message: ChatMessage
): HuntlyUIMessage {
  const parts: HuntlyUIMessage["parts"] = [];

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
    metadata: message.createdAt ? { createdAt: message.createdAt } : undefined,
  };
}

function convertChatMessageToUIMessage(message: ChatMessage): HuntlyUIMessage {
  if (message.role === "user") {
    const userMessage = convertUserChatPartsToUIMessage(
      message.parts,
      message.createdAt
    );

    return {
      id: message.id,
      role: "user",
      parts: userMessage.parts,
      metadata: userMessage.metadata,
    };
  }

  return convertAssistantChatMessageToUIMessage(message);
}

export function convertChatMessagesToUIMessages(
  messages: ChatMessage[]
): HuntlyUIMessage[] {
  return messages.map(convertChatMessageToUIMessage);
}

function convertUserUIMessageToChatParts(message: HuntlyUIMessage): ChatPart[] {
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

function convertAssistantUIMessageToChatParts(
  message: HuntlyUIMessage
): ChatPart[] {
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
        createdAt: new Date().toISOString(),
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

function resolveMessageCreatedAt(
  message: HuntlyUIMessage,
  previousMessagesById: Map<string, ChatMessage>,
  fallbackCreatedAt?: string
): string | undefined {
  return (
    previousMessagesById.get(message.id)?.createdAt ||
    message.metadata?.createdAt ||
    fallbackCreatedAt ||
    new Date().toISOString()
  );
}

export function convertUIMessagesToChatMessages(
  messages: HuntlyUIMessage[],
  status: ChatStatus,
  error: Error | undefined,
  previousMessages: ChatMessage[]
): ChatMessage[] {
  const previousMessagesById = new Map(
    previousMessages.map((message) => [message.id, message])
  );

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
      createdAt: resolveMessageCreatedAt(
        message,
        previousMessagesById,
        result[result.length - 1]?.createdAt
      ),
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
    createdAt: new Date().toISOString(),
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

const FALLBACK_CHAT_MESSAGES: HuntlyUIMessage[] = [];

function createFallbackChat(): Chat<HuntlyUIMessage> {
  return new Chat<HuntlyUIMessage>({
    messages: FALLBACK_CHAT_MESSAGES,
    transport: MISSING_MODEL_TRANSPORT,
  });
}

export function useHuntlyChat(
  options: UseHuntlyChatOptions
): UseHuntlyChatReturn {
  const { chat, hasModel } = options;
  const fallbackChatRef = useRef<Chat<HuntlyUIMessage> | null>(null);
  if (!fallbackChatRef.current) {
    fallbackChatRef.current = createFallbackChat();
  }

  const activeChat = chat ?? fallbackChatRef.current;
  const previousMessagesRef = useRef<ChatMessage[]>([]);

  const {
    messages: uiMessages,
    status,
    error,
    sendMessage: sendUIMessage,
    regenerate: regenerateUIMessage,
    stop,
    setMessages: setUIMessages,
  } = useChat<HuntlyUIMessage>({ chat: activeChat });

  // Reset the "previous messages" memo when the underlying chat instance
  // changes so we don't leak history from one session's messages into
  // another's error-recovery logic.
  useEffect(() => {
    previousMessagesRef.current = [];
  }, [activeChat]);

  const messages = useMemo(
    () =>
      convertUIMessagesToChatMessages(
        uiMessages,
        status,
        error,
        previousMessagesRef.current
      ),
    [uiMessages, status, error]
  );

  useEffect(() => {
    previousMessagesRef.current = messages;
  }, [messages]);

  const isRunning = status === "submitted" || status === "streaming";

  const sendMessage = useCallback(
    (text: string, attachments: ChatPart[] = []) => {
      if (isRunning || !hasModel || !chat) return false;

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
    [chat, hasModel, isRunning, sendUIMessage]
  );

  const regenerate = useCallback(
    (messageId?: string) => {
      if (isRunning || !hasModel || !chat || uiMessages.length === 0) return;
      void regenerateUIMessage(messageId ? { messageId } : undefined);
    },
    [chat, hasModel, isRunning, regenerateUIMessage, uiMessages.length]
  );

  const cancelRun = useCallback(() => {
    void stop();
  }, [stop]);

  const setMessages = useCallback(
    (nextMessages: ChatMessage[]) => {
      if (!chat) return;
      const nextUiMessages = convertChatMessagesToUIMessages(nextMessages);
      setUIMessages(nextUiMessages);
    },
    [chat, setUIMessages]
  );

  const clearMessages = useCallback(() => {
    if (!chat) return;
    setUIMessages([]);
  }, [chat, setUIMessages]);

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
