/**
 * Slash-command system for the Huntly AI sidebar.
 *
 * Loads local extension prompts (system + user), then exposes them as
 * /commands that users can type in the chat input. The user can append
 * additional instructions after the command name, e.g.
 * "/summarize focus on the technical details".
 */

import { getPromptsSettings, getLanguageNativeName } from "../storage";
import type { SlashCommand } from "./types";

interface ParsedInput {
  command: SlashCommand | null;
  userText: string;
  rawInput: string;
}

// ---------------------------------------------------------------------------
// Loading commands
// ---------------------------------------------------------------------------

/**
 * Load all available slash commands from local prompts.
 */
export async function loadSlashCommands(): Promise<SlashCommand[]> {
  const commands: SlashCommand[] = [];

  const promptsSettings = await getPromptsSettings();
  const targetLanguage = promptsSettings.defaultTargetLanguage || "English";
  const nativeLang = getLanguageNativeName(targetLanguage);

  // Local prompts (system + user) only.
  const enabledPrompts = promptsSettings.prompts.filter((p) => p.enabled);

  for (const prompt of enabledPrompts) {
    const content = (prompt.content || "").replace(/\{lang\}/g, nativeLang);
    const trigger = toTrigger(prompt.name);
    if (!trigger) continue;

    if (commands.some((c) => c.trigger === trigger)) continue;

    commands.push({
      id: `local:${prompt.id}`,
      name: prompt.name,
      trigger,
      promptContent: content,
      source: "local",
    });
  }

  return commands;
}

// ---------------------------------------------------------------------------
// Parsing user input
// ---------------------------------------------------------------------------

/**
 * Parse the chat input to detect a /command at the beginning.
 */
export function parseCommandInput(
  input: string,
  commands: SlashCommand[]
): ParsedInput {
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return { command: null, userText: trimmed, rawInput: input };
  }

  // Extract the command word (first token after /)
  const match = trimmed.match(/^\/(\S+)\s*([\s\S]*)$/);
  if (!match) {
    return { command: null, userText: trimmed, rawInput: input };
  }

  const cmdWord = match[1].toLowerCase();
  const rest = match[2].trim();

  // Find matching command
  const command = commands.find((c) => c.trigger === cmdWord);
  if (!command) {
    return { command: null, userText: trimmed, rawInput: input };
  }

  return { command, userText: rest, rawInput: input };
}

/**
 * Filter commands that match a partial input for autocomplete.
 */
export function filterCommands(
  partialInput: string,
  commands: SlashCommand[]
): SlashCommand[] {
  if (!partialInput.startsWith("/")) return [];

  const partial = partialInput.slice(1).toLowerCase();
  if (!partial) return commands; // Show all when just "/" is typed

  return commands.filter(
    (c) =>
      c.trigger.startsWith(partial) || c.name.toLowerCase().startsWith(partial)
  );
}

/**
 * Compose a single user message that instructs the agent to execute
 * a slash command. The system prompt tells the agent how to handle
 * the XML command wrapper.
 */
export function composeCommandMessage(parsed: ParsedInput): string {
  if (!parsed.command) return parsed.userText;

  const prompt = parsed.command.promptContent.trim();
  const commandText = parsed.rawInput.trim();
  const body = [
    commandText,
    prompt,
    parsed.userText ? `User request:\n${parsed.userText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return ["<huntly-command>", body, "</huntly-command>"].join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a display name into a slash-command trigger.
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
