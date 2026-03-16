import { getLocalizedSystemPrompt } from './ai/system-prompts';
import { LANGUAGES } from './languages';
import type { LanguageOption } from './languages';

export { getLocalizedSystemPrompt } from './ai/system-prompts';
export type { SystemPromptContent } from './ai/system-prompts';
export { LANGUAGES } from './languages';
export type { LanguageOption } from './languages';

export const STORAGE_SERVER_URL = "serverUrl";
export const STORAGE_SERVER_URL_LIST = "serverUrlList";
export const STORAGE_AUTO_SAVE_ENABLED = "autoSaveEnabled";
export const STORAGE_AUTO_SAVE_TWEET = "autoSaveTweet";
export const STORAGE_CONTENT_PARSER = "contentParser";
export const STORAGE_DEFAULT_TARGET_LANGUAGE = "defaultTargetLanguage";
export const STORAGE_USER_PROMPTS = "userPrompts";  // User-created prompts only
export const STORAGE_ENABLED_SYSTEM_PROMPTS = "enabledSystemPrompts";  // IDs of enabled system prompts
export const STORAGE_HUNTLY_SHORTCUTS_ENABLED = "huntlyShortcutsEnabled";
export const STORAGE_SELECTED_MODEL_ID = "selectedModelId";  // Remember last selected model
export const STORAGE_THINKING_MODE_ENABLED = "thinkingModeEnabled";  // Remember last thinking mode state

export type ServerUrlItem = {
  url: string,
}

export type ContentParserType = "readability" | "defuddle";

export type Prompt = {
  id: string;
  name: string;
  content: string;
  targetLanguage: string;
  enabled: boolean;
  isSystem: boolean;
  createdAt: number;
  updatedAt: number;
}

// Map browser language code to language option
export function getBrowserLanguage(): string {
  const browserLang = navigator.language.toLowerCase();

  // Handle Chinese variants specifically
  if (browserLang.startsWith('zh')) {
    // zh-TW, zh-HK, zh-Hant are Traditional Chinese
    if (browserLang.includes('tw') || browserLang.includes('hk') || browserLang.includes('hant')) {
      return 'Chinese (Traditional)';
    }
    // zh-CN, zh-Hans, zh (default) are Simplified Chinese
    return 'Chinese (Simplified)';
  }

  // For other languages, match by base code
  const baseCode = browserLang.split('-')[0];
  const matched = LANGUAGES.find(lang => lang.code === baseCode);
  return matched ? matched.english : 'English';
}

// Get native name for a language (for {lang} replacement)
export function getLanguageNativeName(english: string): string {
  const lang = findLanguageByEnglish(english);
  return lang ? lang.native : english;
}

// Find language option by English name (case-insensitive)
export function findLanguageByEnglish(english: string): LanguageOption | undefined {
  return LANGUAGES.find(lang => lang.english.toLowerCase() === english.toLowerCase());
}

export type PromptsSettings = {
  defaultTargetLanguage: string;
  prompts: Prompt[];
  huntlyShortcutsEnabled: boolean;
}

// System prompt IDs in display order
const SYSTEM_PROMPT_IDS = [
  'system_summarize',
  'system_translate',
  'system_bilingual_translate',
  'system_key_points',
  'system_action_items',
  'system_explain'
];

// Generate system prompts based on target language
export function getSystemPrompts(targetLanguage: string): Omit<Prompt, 'createdAt' | 'updatedAt'>[] {
  return SYSTEM_PROMPT_IDS.map(id => {
    const localized = getLocalizedSystemPrompt(id, targetLanguage);
    return {
      id,
      name: localized.name,
      content: localized.content,
      targetLanguage,
      enabled: true,  // All system prompts enabled by default
      isSystem: true,
    };
  });
}

// Legacy SYSTEM_PROMPTS for backward compatibility (uses English version)
export const SYSTEM_PROMPTS: Omit<Prompt, 'createdAt' | 'updatedAt'>[] = getSystemPrompts('English');

export type StorageSettings = {
  serverUrl: string;
  serverUrlList: ServerUrlItem[];
  autoSaveEnabled: boolean;
  autoSaveTweet: boolean;
  contentParser: ContentParserType;
  defaultTargetLanguage: string;
  huntlyShortcutsEnabled: boolean;
}

export const DefaultStorageSettings: StorageSettings = {
  serverUrl: "",
  serverUrlList: [],
  autoSaveEnabled: false,
  autoSaveTweet: false,
  contentParser: "readability",
  defaultTargetLanguage: "English",
  huntlyShortcutsEnabled: true
}

export async function readSyncStorageSettings(): Promise<StorageSettings> {
  const items = await chrome.storage.sync.get(DefaultStorageSettings);
  return {
    serverUrl: items[STORAGE_SERVER_URL] || DefaultStorageSettings.serverUrl,
    serverUrlList: items[STORAGE_SERVER_URL_LIST] || DefaultStorageSettings.serverUrlList,
    autoSaveEnabled: items[STORAGE_AUTO_SAVE_ENABLED] ?? DefaultStorageSettings.autoSaveEnabled,
    autoSaveTweet: items[STORAGE_AUTO_SAVE_TWEET] ?? DefaultStorageSettings.autoSaveTweet,
    contentParser: items[STORAGE_CONTENT_PARSER] || DefaultStorageSettings.contentParser,
    defaultTargetLanguage: items[STORAGE_DEFAULT_TARGET_LANGUAGE] || DefaultStorageSettings.defaultTargetLanguage,
    huntlyShortcutsEnabled: items[STORAGE_HUNTLY_SHORTCUTS_ENABLED] ?? DefaultStorageSettings.huntlyShortcutsEnabled
  };
}

export async function savePromptsSettings(settings: PromptsSettings): Promise<void> {
  // Extract only the necessary data for minimal storage
  const userPrompts = settings.prompts.filter(p => !p.isSystem);
  const enabledSystemPromptIds = settings.prompts
    .filter(p => p.isSystem && p.enabled)
    .map(p => p.id);

  await chrome.storage.sync.set({
    [STORAGE_DEFAULT_TARGET_LANGUAGE]: settings.defaultTargetLanguage,
    [STORAGE_USER_PROMPTS]: userPrompts,
    [STORAGE_ENABLED_SYSTEM_PROMPTS]: enabledSystemPromptIds,
    [STORAGE_HUNTLY_SHORTCUTS_ENABLED]: settings.huntlyShortcutsEnabled
  });
}

export async function getPromptsSettings(): Promise<PromptsSettings> {
  const items = await chrome.storage.sync.get({
    [STORAGE_DEFAULT_TARGET_LANGUAGE]: '',  // Empty string to detect first load
    [STORAGE_USER_PROMPTS]: [],
    [STORAGE_ENABLED_SYSTEM_PROMPTS]: null,  // null to detect if never set
    [STORAGE_HUNTLY_SHORTCUTS_ENABLED]: DefaultStorageSettings.huntlyShortcutsEnabled
  });

  // Use browser language if not set, fallback to English
  let targetLanguage: string = items[STORAGE_DEFAULT_TARGET_LANGUAGE] || getBrowserLanguage();

  // Migrate legacy "Chinese" to "Chinese (Simplified)"
  if (targetLanguage === 'Chinese') {
    targetLanguage = 'Chinese (Simplified)';
  }
  const now = Date.now();

  // Get user prompts
  const userPrompts: Prompt[] = items[STORAGE_USER_PROMPTS] || [];

  // Get enabled system prompt IDs (all enabled by default if not set)
  const enabledSystemPromptIds: string[] | null = items[STORAGE_ENABLED_SYSTEM_PROMPTS];

  // Get system prompts localized for the target language
  const localizedSystemPrompts = getSystemPrompts(targetLanguage);

  // Build the final prompts list
  const mergedPrompts: Prompt[] = [];

  // Add system prompts with correct enabled state
  // If enabledSystemPromptIds is null (first time), all system prompts are enabled
  const enabledSystemPromptSet = enabledSystemPromptIds ? new Set(enabledSystemPromptIds) : null;

  for (const systemPrompt of localizedSystemPrompts) {
    mergedPrompts.push({
      ...systemPrompt,
      enabled: enabledSystemPromptSet ? enabledSystemPromptSet.has(systemPrompt.id) : true,
      createdAt: now,
      updatedAt: now
    });
  }

  // Add user prompts
  mergedPrompts.push(...userPrompts);

  return {
    defaultTargetLanguage: targetLanguage,
    prompts: mergedPrompts,
    huntlyShortcutsEnabled: items[STORAGE_HUNTLY_SHORTCUTS_ENABLED]
  };
}

// Save selected model ID
export async function saveSelectedModelId(modelId: string): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_SELECTED_MODEL_ID]: modelId });
}

// Get saved selected model ID
export async function getSelectedModelId(): Promise<string | null> {
  const items = await chrome.storage.sync.get({ [STORAGE_SELECTED_MODEL_ID]: null });
  return items[STORAGE_SELECTED_MODEL_ID];
}

export async function saveThinkingModeEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_THINKING_MODE_ENABLED]: enabled });
}

export async function getThinkingModeEnabled(): Promise<boolean> {
  const items = await chrome.storage.sync.get({
    [STORAGE_THINKING_MODE_ENABLED]: false,
  });
  return Boolean(items[STORAGE_THINKING_MODE_ENABLED]);
}
