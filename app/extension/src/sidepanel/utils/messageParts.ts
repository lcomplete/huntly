import type { ChatPart, SlashPrompt } from "../types";
import { parsePromptInput } from "../agentPrompts";
import { parseMaybeJson } from "./format";

export interface LinkCardItem {
  href: string;
  title: string;
  description?: string;
  meta?: string;
}

export interface LinkCardGroup {
  id: string;
  title: string;
  items: LinkCardItem[];
  defaultOpen?: boolean;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function getTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed || undefined;
}

function joinMeta(...values: Array<string | undefined>): string | undefined {
  const parts = values.filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" • ") : undefined;
}

type ToolLinkCardExtractor = (result: unknown) => LinkCardGroup[];

function extractSearchHuntlyLinkCards(result: unknown): LinkCardGroup[] {
  const parsed = parseMaybeJson(result);
  if (!isRecord(parsed)) return [];

  const rawResults = parsed.results;
  if (!Array.isArray(rawResults)) return [];

  const items: LinkCardItem[] = [];
  const seen = new Set<string>();

  for (const item of rawResults) {
    if (!isRecord(item)) continue;

    const href = getTrimmedString(item.url);
    const title = getTrimmedString(item.title) || href;
    if (!href || !title || seen.has(href)) {
      continue;
    }

    seen.add(href);
    items.push({
      href,
      title,
      description: getTrimmedString(item.description),
      meta: joinMeta(
        getTrimmedString(item.siteName),
        getTrimmedString(item.domain),
        getTrimmedString(item.author)
      ),
    });
  }

  return items.length > 0
    ? [
        {
          id: "search-results",
          title: "Search results",
          items,
        },
      ]
    : [];
}

const TOOL_LINK_CARD_EXTRACTORS: Record<string, ToolLinkCardExtractor> = {
  search_huntly: extractSearchHuntlyLinkCards,
};

export function extractLinkCardGroups(part: ChatPart): LinkCardGroup[] {
  if (
    part.type !== "tool-call" ||
    !part.toolName ||
    part.result === undefined ||
    part.result === null
  ) {
    return [];
  }

  const extractor = TOOL_LINK_CARD_EXTRACTORS[part.toolName];
  return extractor ? extractor(part.result) : [];
}
