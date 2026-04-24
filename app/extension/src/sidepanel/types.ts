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

export type ChatStatusPartKind = "compacting" | "compacted" | "error";

export type ChatErrorCode =
  | "context-overflow"
  | "auth"
  | "quota"
  | "network"
  | "timeout"
  | "unknown";

export interface SessionRollingSummary {
  text: string;
  summarizedThroughMessageId: string;
  updatedAt: string;
  version: number;
  lastCompactedAt?: string;
}

// ---------------------------------------------------------------------------
// Chat message types
// ---------------------------------------------------------------------------

export interface ChatPart {
  type:
    | "text"
    | "reasoning"
    | "status"
    | "tool-call"
    | "file"
    | "page-context"
    | "step-start";
  id?: string;
  text?: string;
  streaming?: boolean;
  title?: string;
  articleTitle?: string;
  url?: string;
  faviconUrl?: string;
  content?: string;
  description?: string;
  author?: string;
  siteName?: string;
  attachmentId?: string;
  filename?: string;
  mediaType?: string;
  dataUrl?: string;
  size?: number;
  toolCallId?: string;
  toolName?: string;
  toolTitle?: string;
  toolSource?: "local" | "mcp";
  toolSourceLabel?: string;
  args?: Record<string, unknown>;
  argsText?: string;
  result?: unknown;
  isError?: boolean;
  statusKind?: ChatStatusPartKind;
  label?: string;
  message?: string;
  details?: string;
  summary?: string;
  errorCode?: ChatErrorCode;
  retryable?: boolean;
  canCompact?: boolean;
  compactedThroughMessageId?: string;
  compactedMessageCount?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: ChatPart[];
  createdAt?: string;
  status: "complete" | "running" | "error";
}

export type SessionTitleGenerationStatus =
  | "idle"
  | "generated"
  | "failed";

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------
export interface SessionData {
  id: string;
  title: string;
  titleGenerationStatus?: SessionTitleGenerationStatus;
  titleGeneratedAt?: string;
  currentModelId: string | null;
  thinkingEnabled: boolean;
  rollingSummary?: SessionRollingSummary;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  lastMessageId?: string;
  lastOpenedAt?: string;
  pinned?: boolean;
  pinnedAt?: string;
  archived?: boolean;
  archivedAt?: string;
}

export interface SessionMetadata {
  id: string;
  title: string;
  titleGenerationStatus?: SessionTitleGenerationStatus;
  titleGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  lastMessageId?: string;
  lastOpenedAt?: string;
  messageCount: number;
  preview: string;
  currentModelId: string | null;
  pinned?: boolean;
  pinnedAt?: string;
  archived?: boolean;
  archivedAt?: string;
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
