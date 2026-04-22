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
  unsubscribers: Array<() => void>;
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

    const emit = () =>
      this.handler(sessionId, {
        messages: chat.messages,
        status: chat.status,
        error: chat.error,
      });

    const unsubscribers: Array<() => void> = [
      chat["~registerMessagesCallback"](emit),
      chat["~registerStatusCallback"](emit),
      chat["~registerErrorCallback"](emit),
    ];

    this.entries.set(sessionId, { chat, unsubscribers });
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
    try {
      void entry.chat.stop();
    } catch {
      // ignore
    }
    for (const unsub of entry.unsubscribers) {
      try {
        unsub();
      } catch {
        // ignore
      }
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
