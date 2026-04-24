import { streamText } from "ai";

import {
  buildBaseProviderOptions,
  buildThinkingProviderOptions,
} from "../providerOptions";
import type { ChatMessage, ChatPart, HuntlyModelInfo } from "../types";
import { getDisplayMessageText } from "./messageParts";
import { DEFAULT_SESSION_TITLE } from "./sessions";

export const TITLE_MAX_LENGTH = 80;

function summarizeFirstUserMessageForTitle(parts: ChatPart[]): string {
  const segments: string[] = [];
  const text = getDisplayMessageText(parts).replace(/\s+/g, " ").trim();

  if (text) {
    segments.push(text);
  }

  for (const part of parts) {
    if (part.type === "page-context") {
      const label = (part.articleTitle || part.title || part.url || "").trim();
      if (label) {
        segments.push(`Attached page: ${label}`);
      }
      continue;
    }

    if (part.type === "file") {
      const label = (part.filename || part.mediaType || "attachment").trim();
      if (label) {
        segments.push(`Attachment: ${label}`);
      }
    }
  }

  return segments.join(" | ");
}

function normalizeGeneratedSessionTitle(value: string): string | null {
  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return null;

  const normalized = firstLine
    .replace(/^[#>*\-\d.\s]*(?:title|conversation title)\s*:\s*/i, "")
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.。]+$/, "")
    .trim();

  if (!normalized || normalized === DEFAULT_SESSION_TITLE) {
    return null;
  }

  return normalized.length <= TITLE_MAX_LENGTH
    ? normalized
    : `${normalized.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

export async function generateSessionTitleFromFirstMessage(
  message: ChatMessage,
  modelInfo: HuntlyModelInfo,
  systemPrompt: string,
  thinkingEnabled = false,
  abortSignal?: AbortSignal
): Promise<string | null> {
  const source = summarizeFirstUserMessageForTitle(message.parts);
  if (!source) {
    console.warn("[titleGeneration] Skipped: empty first user message");
    return null;
  }

  let streamError: unknown = null;
  const result = streamText({
    model: modelInfo.model as any,
    system: systemPrompt,
    prompt:
      `First user message:\n\n${source}\n\n` +
      "Generate one short conversation title based only on this first user message. Output only the title.",
    maxOutputTokens: 128,
    abortSignal,
    providerOptions: thinkingEnabled
      ? buildThinkingProviderOptions(modelInfo.provider)
      : buildBaseProviderOptions(modelInfo.provider),
    onError({ error }) {
      streamError = error;
    },
  });

  const generatedText = await result.text;
  if (streamError) {
    throw streamError;
  }

  return normalizeGeneratedSessionTitle(generatedText);
}
