/**
 * Slash-prompt system for the Huntly AI sidebar.
 *
 * Loads local extension prompts (system + user), then exposes them as
 * slash prompts that users can type in the chat input. The user can append
 * additional instructions after the prompt name, e.g.
 * "/summarize focus on the technical details".
 */

import { getPromptsSettings, getLanguageNativeName } from "../storage";
import type { SlashPrompt } from "./types";

interface ParsedInput {
  prompt: SlashPrompt | null;
  userText: string;
  rawInput: string;
}

// ---------------------------------------------------------------------------
// Loading prompts
// ---------------------------------------------------------------------------

/**
 * Load all available slash prompts from local prompts.
 */
export async function loadSlashPrompts(): Promise<SlashPrompt[]> {
  const prompts: SlashPrompt[] = [];

  const promptsSettings = await getPromptsSettings();
  const targetLanguage = promptsSettings.defaultTargetLanguage || "English";
  const nativeLang = getLanguageNativeName(targetLanguage);

  // Local prompts (system + user) only.
  const enabledPrompts = promptsSettings.prompts.filter((p) => p.enabled);

  for (const prompt of enabledPrompts) {
    const content = (prompt.content || "").replace(/\{lang\}/g, nativeLang);
    const trigger = toTrigger(prompt.name);
    if (!trigger) continue;

    if (prompts.some((p) => p.trigger === trigger)) continue;

    prompts.push({
      id: `local:${prompt.id}`,
      name: prompt.name,
      trigger,
      promptContent: content,
      source: "local",
    });
  }

  return prompts;
}

// ---------------------------------------------------------------------------
// Parsing user input
// ---------------------------------------------------------------------------

/**
 * Parse the chat input to detect a slash prompt at the beginning.
 */
export function parsePromptInput(
  input: string,
  prompts: SlashPrompt[]
): ParsedInput {
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return { prompt: null, userText: trimmed, rawInput: input };
  }

  // Extract the prompt word (first token after /)
  const match = trimmed.match(/^\/(\S+)\s*([\s\S]*)$/);
  if (!match) {
    return { prompt: null, userText: trimmed, rawInput: input };
  }

  const promptWord = match[1].toLowerCase();
  const rest = match[2].trim();

  // Find matching prompt
  const prompt = prompts.find((p) => p.trigger === promptWord);
  if (!prompt) {
    return { prompt: null, userText: trimmed, rawInput: input };
  }

  return { prompt, userText: rest, rawInput: input };
}

/**
 * Filter prompts that match a partial input for autocomplete.
 */
export function filterPrompts(
  partialInput: string,
  prompts: SlashPrompt[]
): SlashPrompt[] {
  if (!partialInput.startsWith("/")) return [];

  const partial = partialInput.slice(1).toLowerCase();
  if (!partial) return prompts; // Show all when just "/" is typed

  return prompts.filter(
    (prompt) =>
      prompt.trigger.startsWith(partial) ||
      prompt.name.toLowerCase().startsWith(partial)
  );
}

/**
 * Compose a single user message that instructs the agent to execute
 * a slash prompt. The system prompt tells the agent how to handle
 * the XML prompt wrapper.
 */
export function composePromptMessage(parsed: ParsedInput): string {
  if (!parsed.prompt) return parsed.userText;

  const prompt = parsed.prompt.promptContent.trim();
  const promptText = parsed.rawInput.trim();
  const body = [
    promptText,
    prompt,
    parsed.userText ? `User request:\n${parsed.userText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return ["<huntly-prompts>", body, "</huntly-prompts>"].join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a display name into a slash-prompt trigger.
 * e.g. "Summarize" → "summarize", "Key Points" → "key_points"
 */
function toTrigger(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(
      /[^a-z0-9_\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g,
      ""
    );
}
