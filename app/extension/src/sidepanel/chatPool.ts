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

import { createAgentToolContext } from "./agentTools";
import {
  buildMessagesForModel,
  compactConversation,
  estimateContextPressure,
} from "./contextCompaction";
import {
  isContextOverflowError,
  normalizeTransportError,
} from "./transportErrors";
import type {
  ChatMessage,
  HuntlyModelInfo,
  SessionRollingSummary,
} from "./types";
import {
  CHAT_MAX_OUTPUT_TOKENS,
  MISSING_MODEL_TRANSPORT,
  convertChatMessagesToUIMessages,
  convertInlineFileDataPart,
  createAssistantStatusUIMessage,
  replaceInlineFileParts,
  type HuntlyUIMessage,
} from "./useHuntlyChat";
import {
  buildBaseProviderOptions,
  buildThinkingProviderOptions,
} from "./providerOptions";

export interface SessionChatConfig {
  modelInfo: HuntlyModelInfo;
  systemPrompt: string;
  thinkingEnabled: boolean;
}

export interface PoolSnapshot {
  messages: HuntlyUIMessage[];
  status: ChatStatus;
  error: Error | undefined;
  rollingSummary?: SessionRollingSummary;
}

export type PoolEventHandler = (
  sessionId: string,
  snapshot: PoolSnapshot
) => void;

type ConfigProvider = () => SessionChatConfig | null;

interface PoolEntry {
  chat: HuntlyChatInstance;
  pollTimer: ReturnType<typeof setInterval> | null;
  lastMessagesRef: HuntlyUIMessage[] | null;
  lastStatus: ChatStatus | null;
  lastError: Error | undefined;
  rollingSummary?: SessionRollingSummary;
  lastRollingSummaryRef?: SessionRollingSummary;
}

type HuntlyChatInstance = Chat<HuntlyUIMessage> & {
  messages: HuntlyUIMessage[];
  status: ChatStatus;
  error: Error | undefined;
  clearError: () => void;
  sendMessage: (...args: any[]) => Promise<unknown>;
  regenerate: (...args: any[]) => Promise<unknown>;
  resumeStream: (...args: any[]) => Promise<unknown>;
  stop: (...args: any[]) => Promise<unknown>;
  addToolOutput: (...args: any[]) => Promise<unknown>;
  addToolApprovalResponse: (...args: any[]) => Promise<unknown>;
};

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
      entry.lastError === chat.error &&
      entry.lastRollingSummaryRef === entry.rollingSummary
    ) {
      return;
    }

    entry.lastMessagesRef = chat.messages;
    entry.lastStatus = chat.status;
    entry.lastError = chat.error;
    entry.lastRollingSummaryRef = entry.rollingSummary;

    this.handler(sessionId, {
      messages: chat.messages,
      status: chat.status,
      error: chat.error,
      rollingSummary: entry.rollingSummary,
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

  private buildTransport(sessionId: string): ChatTransport<HuntlyUIMessage> {
    return {
      sendMessages: async ({ messages, abortSignal }) => {
        const config = this.getConfig();
        if (!config) {
          return MISSING_MODEL_TRANSPORT.sendMessages({
            messages,
            abortSignal,
          } as any);
        }

        return this.sendSessionMessages(
          sessionId,
          config,
          messages,
          abortSignal
        );
      },
      async reconnectToStream() {
        return null;
      },
    };
  }

  private async startAssistantStream(
    config: SessionChatConfig,
    messages: HuntlyUIMessage[],
    abortSignal: AbortSignal
  ): Promise<ReadableStream<any>> {
    const toolContext = await createAgentToolContext();

    try {
      const agent = new ToolLoopAgent({
        model: config.modelInfo.model,
        instructions: config.systemPrompt,
        tools: toolContext.tools as any,
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
        replaceInlineFileParts(validated as HuntlyUIMessage[]),
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
        onFinish: async () => {
          try {
            await toolContext.close();
          } catch (error) {
            console.error(
              "[SessionChatPool] Failed to close MCP clients",
              error
            );
          }
        },
      });
    } catch (error) {
      try {
        await toolContext.close();
      } catch (closeError) {
        console.error(
          "[SessionChatPool] Failed to close MCP clients",
          closeError
        );
      }
      throw error;
    }
  }

  private resolveRollingSummary(
    sessionId: string,
    messages: HuntlyUIMessage[]
  ): SessionRollingSummary | undefined {
    const entry = this.entries.get(sessionId);
    if (!entry?.rollingSummary) {
      return undefined;
    }

    const prepared = buildMessagesForModel(messages, entry.rollingSummary);
    if (!prepared.rollingSummary) {
      entry.rollingSummary = undefined;
      this.emit(sessionId, entry, true);
      return undefined;
    }

    return prepared.rollingSummary;
  }

  private setRollingSummary(
    sessionId: string,
    rollingSummary?: SessionRollingSummary
  ): void {
    const entry = this.entries.get(sessionId);
    if (!entry) {
      return;
    }

    entry.rollingSummary = rollingSummary;
    this.emit(sessionId, entry, true);
  }

  private appendAssistantStatusMessage(
    sessionId: string,
    data: Parameters<typeof createAssistantStatusUIMessage>[0]
  ): string | null {
    const entry = this.entries.get(sessionId);
    if (!entry) {
      return null;
    }

    const message = createAssistantStatusUIMessage(data);
    entry.chat.messages = [...entry.chat.messages, message];
    return message.id;
  }

  private updateAssistantStatusMessage(
    sessionId: string,
    messageId: string,
    data: Parameters<typeof createAssistantStatusUIMessage>[0]
  ): void {
    const entry = this.entries.get(sessionId);
    if (!entry) {
      return;
    }

    const messageIndex = entry.chat.messages.findIndex(
      (message) => message.id === messageId
    );
    const createdAt =
      messageIndex >= 0
        ? entry.chat.messages[messageIndex].metadata?.createdAt
        : undefined;
    const nextMessage = createAssistantStatusUIMessage(data, {
      id: messageId,
      createdAt,
    });

    if (messageIndex === -1) {
      entry.chat.messages = [...entry.chat.messages, nextMessage];
      return;
    }

    const nextMessages = [...entry.chat.messages];
    nextMessages[messageIndex] = nextMessage;
    entry.chat.messages = nextMessages;
  }

  private removeMessage(sessionId: string, messageId: string): void {
    const entry = this.entries.get(sessionId);
    if (!entry) {
      return;
    }

    entry.chat.messages = entry.chat.messages.filter(
      (message) => message.id !== messageId
    );
  }

  private async compactSessionInternal(
    sessionId: string,
    options?: {
      abortSignal?: AbortSignal;
      showStatusMessage?: boolean;
    }
  ): Promise<boolean> {
    const entry = this.entries.get(sessionId);
    const config = this.getConfig();
    if (!entry || !config) {
      return false;
    }

    entry.chat.clearError();

    const activeSummary = this.resolveRollingSummary(
      sessionId,
      entry.chat.messages
    );
    const pressure = estimateContextPressure(
      entry.chat.messages,
      activeSummary
    );
    if (!pressure.canCompact) {
      return false;
    }

    const statusMessageId = options?.showStatusMessage
      ? this.appendAssistantStatusMessage(sessionId, {
          kind: "compacting",
        })
      : null;

    try {
      const result = await compactConversation({
        messages: entry.chat.messages,
        rollingSummary: activeSummary,
        modelInfo: config.modelInfo,
        abortSignal: options?.abortSignal,
      });

      if (!result) {
        if (statusMessageId) {
          this.removeMessage(sessionId, statusMessageId);
        }
        return false;
      }

      this.setRollingSummary(sessionId, result.rollingSummary);

      if (statusMessageId) {
        this.updateAssistantStatusMessage(sessionId, statusMessageId, {
          kind: "compacted",
          summary: result.rollingSummary.text,
          compactedMessageCount: result.compactedMessageCount,
          compactedThroughMessageId: result.compactedThroughMessageId,
        });
      }

      return true;
    } catch (error) {
      if (statusMessageId) {
        this.removeMessage(sessionId, statusMessageId);
      }
      throw error;
    }
  }

  private async sendSessionMessages(
    sessionId: string,
    config: SessionChatConfig,
    messages: HuntlyUIMessage[],
    abortSignal: AbortSignal
  ): Promise<ReadableStream<any>> {
    let sourceMessages = messages;
    let activeSummary = this.resolveRollingSummary(sessionId, sourceMessages);
    let initialPressure = estimateContextPressure(
      sourceMessages,
      activeSummary
    );

    if (initialPressure.isLong && initialPressure.canCompact) {
      const compacted = await this.compactSessionInternal(sessionId, {
        abortSignal,
        showStatusMessage: true,
      }).catch((error) => {
        console.error("[SessionChatPool] Failed to pre-compact context", error);
        return false;
      });

      if (compacted) {
        const entry = this.entries.get(sessionId);
        sourceMessages = entry?.chat.messages || sourceMessages;
        activeSummary = entry?.rollingSummary;
        initialPressure = estimateContextPressure(
          sourceMessages,
          activeSummary
        );
      }
    }

    const initialBuild = buildMessagesForModel(sourceMessages, activeSummary);

    try {
      return await this.startAssistantStream(
        config,
        initialBuild.messages,
        abortSignal
      );
    } catch (error) {
      if (isContextOverflowError(error)) {
        const compacted = await this.compactSessionInternal(sessionId, {
          abortSignal,
          showStatusMessage: true,
        }).catch(() => false);

        if (compacted) {
          const retrySourceMessages =
            this.entries.get(sessionId)?.chat.messages || messages;
          const retrySummary = this.entries.get(sessionId)?.rollingSummary;
          const retryBuild = buildMessagesForModel(
            retrySourceMessages,
            retrySummary
          );

          try {
            return await this.startAssistantStream(
              config,
              retryBuild.messages,
              abortSignal
            );
          } catch (retryError) {
            throw normalizeTransportError(retryError, {
              canCompact: estimateContextPressure(
                retrySourceMessages,
                retryBuild.rollingSummary
              ).canCompact,
            });
          }
        }
      }

      throw normalizeTransportError(error, {
        canCompact: initialPressure.canCompact,
      });
    }
  }

  /**
   * Create the Chat for `sessionId` if it does not exist yet. Initial messages
   * are only used on first creation; if the entry already exists, they are
   * ignored and the live in-memory Chat state is preserved.
   */
  ensure(
    sessionId: string,
    initialMessages: ChatMessage[] = [],
    initialRollingSummary?: SessionRollingSummary
  ): Chat<HuntlyUIMessage> {
    const existing = this.entries.get(sessionId);
    if (existing) return existing.chat;

    const chat = new Chat<HuntlyUIMessage>({
      messages: convertChatMessagesToUIMessages(initialMessages),
      transport: this.buildTransport(sessionId),
    }) as HuntlyChatInstance;

    const entry: PoolEntry = {
      chat,
      pollTimer: null,
      lastMessagesRef: chat.messages,
      lastStatus: chat.status,
      lastError: chat.error,
      rollingSummary: initialRollingSummary,
      lastRollingSummaryRef: initialRollingSummary,
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

  compact(sessionId: string): Promise<boolean> {
    return this.compactSessionInternal(sessionId, {
      showStatusMessage: true,
    });
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
