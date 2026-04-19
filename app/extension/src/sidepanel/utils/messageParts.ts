import type { ChatPart, SlashPrompt } from "../types";
import { parsePromptInput } from "../agentPrompts";
import { parseMaybeJson } from "./format";

export interface ExtractedSource {
  href: string;
  title: string;
}

export interface DisplayMessage {
  text: string;
  promptPrefix: string | null;
}

const HUNTLY_PROMPT_WRAPPER_RE =
  /^\s*<huntly-(?:prompts|command)>\s*\n\s*(\/[^\n]+)[\s\S]*?\n\s*<\/huntly-(?:prompts|command)>\s*$/i;

export function getMessageText(parts: ChatPart[]): string {
  return parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n");
}

export function getDisplayMessage(parts: ChatPart[]): DisplayMessage {
  const text = getMessageText(parts);
  const promptMatch = text.match(HUNTLY_PROMPT_WRAPPER_RE);

  if (!promptMatch) return { text, promptPrefix: null };

  const displayText = promptMatch[1].trim();
  const prefix = displayText.match(/^\/\S+/)?.[0] || null;
  return { text: displayText, promptPrefix: prefix };
}

export function getDisplayMessageText(parts: ChatPart[]): string {
  return getDisplayMessage(parts).text;
}

export function getTriggeredPromptPrefix(
  inputText: string,
  prompts: SlashPrompt[]
): string | null {
  const parsed = parsePromptInput(inputText, prompts);
  return parsed.prompt ? `/${parsed.prompt.trigger}` : null;
}

export function addSlashPromptToInput(
  prompt: SlashPrompt,
  inputText: string
): string {
  const remainingText = inputText.startsWith("/")
    ? inputText.replace(/^\/\S*\s*/, "")
    : inputText.trimStart();

  return `/${prompt.trigger} ${remainingText}`;
}

export function extractSources(parts: ChatPart[]): ExtractedSource[] {
  const sources: ExtractedSource[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (
      part.type !== "tool-call" ||
      part.toolName !== "search_huntly" ||
      !part.result
    ) {
      continue;
    }

    const parsed = parseMaybeJson(part.result);
    if (!parsed || typeof parsed !== "object") continue;

    const results = (parsed as { results?: unknown }).results;
    if (!Array.isArray(results)) continue;

    for (const item of results) {
      if (!item || typeof item !== "object") continue;
      const result = item as { url?: unknown; title?: unknown };
      if (typeof result.url !== "string" || typeof result.title !== "string") {
        continue;
      }
      if (seen.has(result.url)) continue;
      seen.add(result.url);
      sources.push({ href: result.url, title: result.title });
    }
  }

  return sources;
}
