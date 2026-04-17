/**
 * Shared types for the Huntly AI sidepanel agent.
 */

import type { LanguageModelV3 } from "@ai-sdk/provider";

// ---------------------------------------------------------------------------
// Model info for UI display
// ---------------------------------------------------------------------------
export interface HuntlyModelInfo {
  /** The AI SDK LanguageModel instance */
  model: LanguageModelV3;
  /** The model identifier string */
  modelId: string;
  /** Provider identifier */
  provider: string;
  /** Display name for the UI */
  displayName: string;
}

// ---------------------------------------------------------------------------
// Chat message types
// ---------------------------------------------------------------------------

export interface ChatPart {
  type: "text" | "reasoning" | "tool-call" | "file" | "page-context";
  id?: string;
  text?: string;
  title?: string;
  articleTitle?: string;
  url?: string;
  faviconUrl?: string;
  content?: string;
  description?: string;
  author?: string;
  siteName?: string;
  filename?: string;
  mediaType?: string;
  dataUrl?: string;
  size?: number;
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  argsText?: string;
  result?: string;
  isError?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: ChatPart[];
  status: "complete" | "running" | "error";
}

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------
export interface SessionData {
  id: string;
  title: string;
  currentModelId: string | null;
  thinkingEnabled: boolean;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  lastMessageId?: string;
  lastOpenedAt?: string;
}

export interface SessionMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  lastMessageId?: string;
  lastOpenedAt?: string;
  messageCount: number;
  preview: string;
  currentModelId: string | null;
}

// ---------------------------------------------------------------------------
// Slash prompts
// ---------------------------------------------------------------------------
export interface SlashPrompt {
  id: string;
  name: string;
  trigger: string;
  promptContent: string;
  source: "local";
}
