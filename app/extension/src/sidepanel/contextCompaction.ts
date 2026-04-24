import {
  streamText,
  isDataUIPart,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
} from "ai";

import { buildBaseProviderOptions } from "./providerOptions";
import type { HuntlyUIMessage } from "./useHuntlyChat";
import type { HuntlyModelInfo, SessionRollingSummary } from "./types";

const ATTACHED_PAGE_CONTEXT_RE =
  /^\s*<attached-page-context>\s*([\s\S]*?)\s*<\/attached-page-context>\s*$/i;
const CONTENT_SECTION_RE = /(?:^|\n)\s*Content:\s*\n([\s\S]*)$/i;
const RECENT_RAW_MESSAGE_COUNT = 8;
const MIN_COMPACTIBLE_MESSAGES = 4;
const LONG_CONTEXT_CHAR_THRESHOLD = 24000;
const MAX_COMPACTION_SOURCE_CHARS = 18000;
const MAX_MESSAGE_TRANSCRIPT_CHARS = 1800;
const SUMMARY_MAX_OUTPUT_TOKENS = 640;
const MAX_SUMMARY_CHARS = 5000;

export interface ContextPressure {
  approxChars: number;
  canCompact: boolean;
  isLong: boolean;
  compactableMessageCount: number;
}

export interface ContextCompactionResult {
  rollingSummary: SessionRollingSummary;
  compactedMessageCount: number;
  compactedThroughMessageId: string;
}

function clampText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.length <= limit
    ? normalized
    : `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function sanitizeAssistantPartsForModel(
  message: HuntlyUIMessage
): HuntlyUIMessage["parts"] {
  return message.parts.filter((part) => {
    if (isReasoningUIPart(part)) {
      return false;
    }

    if (isDataUIPart(part)) {
      return false;
    }

    return true;
  });
}

function sanitizeMessagesForModel(
  messages: HuntlyUIMessage[]
): HuntlyUIMessage[] {
  return messages.flatMap((message) => {
    if (message.role === "assistant") {
      const parts = sanitizeAssistantPartsForModel(message);
      return parts.length > 0 ? [{ ...message, parts }] : [];
    }

    if (message.role === "user") {
      const parts = message.parts.filter((part) => !isDataUIPart(part));
      return parts.length > 0 ? [{ ...message, parts }] : [];
    }

    return [message];
  });
}

function findSummaryBoundaryIndex(
  messages: HuntlyUIMessage[],
  rollingSummary?: SessionRollingSummary
): number {
  if (!rollingSummary?.summarizedThroughMessageId) {
    return -1;
  }

  return messages.findIndex(
    (message) => message.id === rollingSummary.summarizedThroughMessageId
  );
}

function getConversationMessagesAfterSummary(
  messages: HuntlyUIMessage[],
  rollingSummary?: SessionRollingSummary
): HuntlyUIMessage[] {
  const sanitized = sanitizeMessagesForModel(messages).filter(
    (message) => message.role !== "system"
  );
  const boundaryIndex = findSummaryBoundaryIndex(sanitized, rollingSummary);

  if (rollingSummary && boundaryIndex === -1) {
    return sanitizeMessagesForModel(messages).filter(
      (message) => message.role !== "system"
    );
  }

  return sanitized.slice(boundaryIndex + 1);
}

function getCompactibleMessages(
  messages: HuntlyUIMessage[],
  rollingSummary?: SessionRollingSummary
): HuntlyUIMessage[] {
  const unsummarized = getConversationMessagesAfterSummary(
    messages,
    rollingSummary
  );
  const eligibleCount = unsummarized.length - RECENT_RAW_MESSAGE_COUNT;

  if (eligibleCount < MIN_COMPACTIBLE_MESSAGES) {
    return [];
  }

  const selected: HuntlyUIMessage[] = [];
  let selectedChars = 0;

  for (const message of unsummarized.slice(0, eligibleCount)) {
    const approxChars = approximateMessageChars(message);
    if (
      selected.length >= MIN_COMPACTIBLE_MESSAGES &&
      selectedChars + approxChars > MAX_COMPACTION_SOURCE_CHARS
    ) {
      break;
    }

    selected.push(message);
    selectedChars += approxChars;
  }

  return selected;
}

function buildRollingSummarySystemMessage(
  rollingSummary: SessionRollingSummary
): HuntlyUIMessage {
  return {
    id: `rolling-summary-${rollingSummary.summarizedThroughMessageId}`,
    role: "system",
    parts: [
      {
        type: "text",
        text:
          "Compressed conversation memory for earlier turns:\n\n" +
          `${rollingSummary.text}\n\n` +
          "Treat this as a faithful summary of the earlier conversation up through the compacted boundary. If newer raw turns conflict with it, prefer the newer raw turns.",
      },
    ],
  };
}

function parseAttachedPageContext(text: string): {
  title?: string;
  articleTitle?: string;
  url?: string;
  content?: string;
} | null {
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
    title,
    articleTitle,
    url,
    content: contentMatch?.[1]?.trim() || "",
  };
}

function describeMessageForSummary(message: HuntlyUIMessage): string {
  const segments: string[] = [];

  for (const part of message.parts) {
    if (isTextUIPart(part)) {
      const pageContext = parseAttachedPageContext(part.text);
      if (pageContext) {
        const pageLabel = clampText(
          [pageContext.articleTitle, pageContext.title, pageContext.url]
            .filter(Boolean)
            .join(" | "),
          180
        );
        const pageBody = clampText(pageContext.content || "", 700);
        if (pageLabel) {
          segments.push(`Attached page context: ${pageLabel}`);
        }
        if (pageBody) {
          segments.push(`Page content excerpt: ${pageBody}`);
        }
        continue;
      }

      const text = clampText(part.text, 900);
      if (text) {
        segments.push(text);
      }
      continue;
    }

    if (part.type === "file") {
      const label = clampText(
        [part.filename, part.mediaType].filter(Boolean).join(" | "),
        180
      );
      if (label) {
        segments.push(`Attachment: ${label}`);
      }
      continue;
    }

    if (isToolUIPart(part)) {
      const input = clampText(stringifyValue(part.input), 320);
      const output = clampText(
        part.state === "output-error"
          ? part.errorText || "Tool execution failed."
          : stringifyValue(
              part.state === "output-available" ? part.output : undefined
            ),
        700
      );

      segments.push(
        [
          `Tool ${
            part.type === "dynamic-tool"
              ? part.toolName
              : part.type.slice("tool-".length)
          }`,
          input ? `input: ${input}` : undefined,
          output ? `output: ${output}` : undefined,
        ]
          .filter(Boolean)
          .join("; ")
      );
    }
  }

  const transcript = segments.join("\n").trim();
  if (!transcript) {
    return "";
  }

  return `${message.role === "user" ? "User" : "Assistant"}: ${clampText(
    transcript,
    MAX_MESSAGE_TRANSCRIPT_CHARS
  )}`;
}

function approximateMessageChars(message: HuntlyUIMessage): number {
  return message.parts.reduce((total, part) => {
    if (isReasoningUIPart(part)) {
      return total;
    }

    if (isTextUIPart(part)) {
      return total + part.text.length;
    }

    if (part.type === "file") {
      return (
        total +
        part.url.length +
        (part.filename?.length || 0) +
        part.mediaType.length
      );
    }

    if (isToolUIPart(part)) {
      const payload =
        stringifyValue(part.input) +
        stringifyValue(
          part.state === "output-available"
            ? part.output
            : part.state === "output-error"
            ? part.errorText
            : undefined
        );
      return total + payload.length;
    }

    if (isDataUIPart(part)) {
      return total;
    }

    return total;
  }, 0);
}

function normalizeRollingSummaryText(value: string): string | null {
  const normalized = clampText(value, MAX_SUMMARY_CHARS);
  return normalized || null;
}

export function estimateContextPressure(
  messages: HuntlyUIMessage[],
  rollingSummary?: SessionRollingSummary
): ContextPressure {
  const activeSummary =
    rollingSummary && findSummaryBoundaryIndex(messages, rollingSummary) !== -1
      ? rollingSummary
      : undefined;
  const unsummarized = getConversationMessagesAfterSummary(
    messages,
    activeSummary
  );
  const compactableMessages = getCompactibleMessages(messages, activeSummary);
  const approxChars =
    (activeSummary?.text.length || 0) +
    unsummarized.reduce(
      (total, message) => total + approximateMessageChars(message),
      0
    );

  return {
    approxChars,
    canCompact: compactableMessages.length > 0,
    isLong:
      approxChars >= LONG_CONTEXT_CHAR_THRESHOLD ||
      compactableMessages.length >= MIN_COMPACTIBLE_MESSAGES,
    compactableMessageCount: compactableMessages.length,
  };
}

export function buildMessagesForModel(
  messages: HuntlyUIMessage[],
  rollingSummary?: SessionRollingSummary
): {
  messages: HuntlyUIMessage[];
  rollingSummary?: SessionRollingSummary;
} {
  const activeSummary =
    rollingSummary && findSummaryBoundaryIndex(messages, rollingSummary) !== -1
      ? rollingSummary
      : undefined;
  const sanitized = sanitizeMessagesForModel(messages);

  if (!activeSummary) {
    return {
      messages: sanitized.filter((message) => message.role !== "system"),
    };
  }

  const boundaryIndex = findSummaryBoundaryIndex(sanitized, activeSummary);
  const postSummaryMessages = sanitized
    .filter((message) => message.role !== "system")
    .slice(boundaryIndex + 1);

  return {
    rollingSummary: activeSummary,
    messages: [
      buildRollingSummarySystemMessage(activeSummary),
      ...postSummaryMessages,
    ],
  };
}

export async function compactConversation(options: {
  messages: HuntlyUIMessage[];
  rollingSummary?: SessionRollingSummary;
  modelInfo: HuntlyModelInfo;
  abortSignal?: AbortSignal;
}): Promise<ContextCompactionResult | null> {
  const activeSummary =
    options.rollingSummary &&
    findSummaryBoundaryIndex(options.messages, options.rollingSummary) !== -1
      ? options.rollingSummary
      : undefined;
  const compactible = getCompactibleMessages(options.messages, activeSummary);

  if (compactible.length === 0) {
    return null;
  }

  const transcript = compactible
    .map(describeMessageForSummary)
    .filter(Boolean)
    .join("\n\n");

  if (!transcript.trim()) {
    return null;
  }

  let streamError: unknown = null;
  const result = streamText({
    model: options.modelInfo.model as any,
    system:
      "You compress earlier chat turns into a durable rolling summary for future assistant calls. Keep only information that matters for continuing the conversation: the user's goal, explicit constraints, confirmed facts, important tool findings, page context conclusions, and unresolved questions. Be concise, precise, and avoid filler.",
    prompt:
      `Existing rolling summary:\n\n${
        activeSummary?.text || "(none yet)"
      }\n\n` +
      `New conversation turns to compact:\n\n${transcript}\n\n` +
      "Write the updated rolling summary in markdown with short bullet lists under these headings: User goal, Constraints, Confirmed facts, Tool findings, Open threads.",
    maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
    abortSignal: options.abortSignal,
    providerOptions: buildBaseProviderOptions(options.modelInfo.provider),
    onError({ error }) {
      streamError = error;
    },
  });

  const generatedText = await result.text;
  if (streamError) {
    throw streamError;
  }

  const summaryText = normalizeRollingSummaryText(generatedText);
  if (!summaryText) {
    return null;
  }

  const now = new Date().toISOString();
  const compactedThroughMessageId = compactible[compactible.length - 1].id;

  return {
    rollingSummary: {
      text: summaryText,
      summarizedThroughMessageId: compactedThroughMessageId,
      updatedAt: now,
      version: (activeSummary?.version || 0) + 1,
      lastCompactedAt: now,
    },
    compactedMessageCount: compactible.length,
    compactedThroughMessageId,
  };
}
