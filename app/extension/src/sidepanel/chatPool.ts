/**
 * SessionChatPool — keeps one AI SDK `Chat` instance per conversation so that
 * multiple sessions can run in parallel. Switching sessions in the UI never
 * cancels an in-flight stream; it only changes which `Chat` the UI is
 * subscribed to. Each chat keeps firing the pool event handler while it
 * streams, so persistence and title generation continue in the background.
 */

import { Chat } from "@ai-sdk/react";
import {
  ToolLoopAgent,
  convertToModelMessages,
  stepCountIs,
  validateUIMessages,
  type ChatStatus,
  type ChatTransport,
} from "ai";

import { ALL_AGENT_TOOLS } from "./agentTools";
import type { HuntlyModelInfo } from "./types";
import {
  CHAT_MAX_OUTPUT_TOKENS,
  MISSING_MODEL_TRANSPORT,
  buildBaseProviderOptions,
  buildThinkingProviderOptions,
  convertChatMessagesToUIMessages,
  convertInlineFileDataPart,
  replaceInlineFileParts,
  type HuntlyUIMessage,
} from "./useHuntlyChat";
import type { ChatMessage } from "./types";

export interface SessionChatConfig {
  modelInfo: HuntlyModelInfo;
  systemPrompt: string;
  thinkingEnabled: boolean;
}

export interface PoolSnapshot {
  messages: HuntlyUIMessage[];
  status: ChatStatus;
  error: Error | undefined;
}

export type PoolEventHandler = (
  sessionId: string,
  snapshot: PoolSnapshot
) => void;

type ConfigProvider = () => SessionChatConfig | null;

interface PoolEntry {
  chat: Chat<HuntlyUIMessage>;
  pollTimer: ReturnType<typeof setInterval> | null;
  lastMessagesRef: HuntlyUIMessage[] | null;
  lastStatus: ChatStatus | null;
  lastError: Error | undefined;
}

const CHAT_POLL_INTERVAL_MS = 100;

function isChatRunning(status: ChatStatus): boolean {
  return status === "submitted" || status === "streaming";
}

function findPropertyDescriptor(
  value: object,
  propertyName: PropertyKey
): PropertyDescriptor | undefined {
  let current: object | null = value;

  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, propertyName);
    if (descriptor) {
      return descriptor;
    }

    current = Object.getPrototypeOf(current);
  }

  return undefined;
}

function buildTransport(
  getConfig: ConfigProvider
): ChatTransport<HuntlyUIMessage> {
  return {
    async sendMessages({ messages, abortSignal }) {
      const config = getConfig();
      if (!config) {
        return MISSING_MODEL_TRANSPORT.sendMessages({
          messages,
          abortSignal,
        } as any);
      }

      const agent = new ToolLoopAgent({
        model: config.modelInfo.model,
        instructions: config.systemPrompt,
        tools: ALL_AGENT_TOOLS,
        stopWhen: stepCountIs(5),
        maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
        providerOptions: config.thinkingEnabled
          ? buildThinkingProviderOptions(config.modelInfo.provider)
          : buildBaseProviderOptions(config.modelInfo.provider),
      });

      const validated = await validateUIMessages({
        messages,
        tools: agent.tools as any,
      });
      const modelMessages = await convertToModelMessages(
        replaceInlineFileParts(validated),
        {
          tools: agent.tools as any,
          convertDataPart: convertInlineFileDataPart,
        }
      );
      const result = await agent.stream({
        prompt: modelMessages,
        abortSignal,
      });
      return result.toUIMessageStream({
        sendReasoning: config.thinkingEnabled,
      });
    },
    async reconnectToStream() {
      return null;
    },
  };
}

export class SessionChatPool {
  private entries = new Map<string, PoolEntry>();

  constructor(
    private readonly getConfig: ConfigProvider,
    private readonly handler: PoolEventHandler
  ) {}

  has(sessionId: string): boolean {
    return this.entries.has(sessionId);
  }

  get(sessionId: string): Chat<HuntlyUIMessage> | null {
    return this.entries.get(sessionId)?.chat ?? null;
  }

  private emit(sessionId: string, entry: PoolEntry, force = false): void {
    const { chat } = entry;
    if (
      !force &&
      entry.lastMessagesRef === chat.messages &&
      entry.lastStatus === chat.status &&
      entry.lastError === chat.error
    ) {
      return;
    }

    entry.lastMessagesRef = chat.messages;
    entry.lastStatus = chat.status;
    entry.lastError = chat.error;

    this.handler(sessionId, {
      messages: chat.messages,
      status: chat.status,
      error: chat.error,
    });
  }

  private stopPolling(entry: PoolEntry): void {
    if (entry.pollTimer === null) {
      return;
    }

    clearInterval(entry.pollTimer);
    entry.pollTimer = null;
  }

  private syncPolling(sessionId: string, entry: PoolEntry): void {
    if (!isChatRunning(entry.chat.status)) {
      this.stopPolling(entry);
      return;
    }

    if (entry.pollTimer !== null) {
      return;
    }

    entry.pollTimer = setInterval(() => {
      this.emit(sessionId, entry);

      if (!isChatRunning(entry.chat.status)) {
        this.stopPolling(entry);
      }
    }, CHAT_POLL_INTERVAL_MS);
  }

  private instrumentChat(sessionId: string, entry: PoolEntry): void {
    const { chat } = entry;
    const mutableChat = chat as Record<string, any>;
    const messagesDescriptor = findPropertyDescriptor(chat, "messages");

    if (messagesDescriptor?.get && messagesDescriptor.set) {
      Object.defineProperty(chat, "messages", {
        configurable: true,
        enumerable: false,
        get: () => messagesDescriptor.get!.call(chat) as HuntlyUIMessage[],
        set: (messages: HuntlyUIMessage[]) => {
          messagesDescriptor.set!.call(chat, messages);
          this.emit(sessionId, entry, true);
          this.syncPolling(sessionId, entry);
        },
      });
    }

    const wrapAsyncMethod = <TArgs extends unknown[], TResult>(
      methodName:
        | "sendMessage"
        | "regenerate"
        | "resumeStream"
        | "stop"
        | "addToolOutput"
        | "addToolApprovalResponse"
    ) => {
      const original = mutableChat[methodName].bind(chat) as (
        ...args: TArgs
      ) => Promise<TResult>;

      mutableChat[methodName] = async (...args: TArgs) => {
        const resultPromise = original(...args);
        this.emit(sessionId, entry, true);
        this.syncPolling(sessionId, entry);

        try {
          return await resultPromise;
        } finally {
          this.emit(sessionId, entry);
          this.syncPolling(sessionId, entry);
        }
      };
    };

    const wrapSyncMethod = (methodName: "clearError") => {
      const original = mutableChat[methodName].bind(chat) as () => void;

      mutableChat[methodName] = () => {
        original();
        this.emit(sessionId, entry, true);
        this.syncPolling(sessionId, entry);
      };
    };

    wrapAsyncMethod("sendMessage");
    wrapAsyncMethod("regenerate");
    wrapAsyncMethod("resumeStream");
    wrapAsyncMethod("stop");
    wrapAsyncMethod("addToolOutput");
    wrapAsyncMethod("addToolApprovalResponse");
    wrapSyncMethod("clearError");
  }

  /**
   * Create the Chat for `sessionId` if it does not exist yet. Initial messages
   * are only used on first creation; if the entry already exists, they are
   * ignored and the live in-memory Chat state is preserved.
   */
  ensure(
    sessionId: string,
    initialMessages: ChatMessage[] = []
  ): Chat<HuntlyUIMessage> {
    const existing = this.entries.get(sessionId);
    if (existing) return existing.chat;

    const transport = buildTransport(this.getConfig);
    const chat = new Chat<HuntlyUIMessage>({
      messages: convertChatMessagesToUIMessages(initialMessages),
      transport,
    });

    const entry: PoolEntry = {
      chat,
      pollTimer: null,
      lastMessagesRef: chat.messages,
      lastStatus: chat.status,
      lastError: chat.error,
    };

    this.instrumentChat(sessionId, entry);
    this.entries.set(sessionId, entry);
    return chat;
  }

  /**
   * Whether the session's chat currently has an in-flight request.
   */
  isRunning(sessionId: string): boolean {
    const chat = this.entries.get(sessionId)?.chat;
    if (!chat) return false;
    return chat.status === "submitted" || chat.status === "streaming";
  }

  /** Stop and dispose the Chat for the given session, if any. */
  remove(sessionId: string): void {
    const entry = this.entries.get(sessionId);
    if (!entry) return;
    this.stopPolling(entry);
    try {
      void entry.chat.stop();
    } catch {
      // ignore
    }
    this.entries.delete(sessionId);
  }

  /** Stop all chats and clear the pool. */
  disposeAll(): void {
    for (const sessionId of Array.from(this.entries.keys())) {
      this.remove(sessionId);
    }
  }
}
