export const STORAGE_SERVER_URL = "serverUrl";
export const STORAGE_SERVER_URL_LIST = "serverUrlList";
export const STORAGE_AUTO_SAVE_ENABLED = "autoSaveEnabled";
export const STORAGE_AUTO_SAVE_TWEET = "autoSaveTweet";
export const STORAGE_CONTENT_PARSER = "contentParser";
export const STORAGE_DEFAULT_TARGET_LANGUAGE = "defaultTargetLanguage";
export const STORAGE_PROMPTS = "prompts";
export const STORAGE_HUNTLY_SHORTCUTS_ENABLED = "huntlyShortcutsEnabled";

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

export type PromptsSettings = {
  defaultTargetLanguage: string;
  prompts: Prompt[];
  huntlyShortcutsEnabled: boolean;
}

export const SYSTEM_PROMPTS: Omit<Prompt, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'system_summarize',
    name: 'Summarize',
    content: `You are a professional article summarization assistant. Generate a high-quality summary following these requirements:

1. Include main ideas and key information
2. Stay objective, no personal opinions
3. Clear structure, concise language
4. Keep it brief but comprehensive, no longer than half the original length

IMPORTANT: You MUST output the entire response in {lang}. Do not use any other language.`,
    targetLanguage: 'Chinese',
    enabled: true,
    isSystem: true,
  },
  {
    id: 'system_translate',
    name: 'Translate',
    content: `You are a professional translator. Translate the following article following these requirements:

1. Preserve the original meaning and style
2. Use professional and idiomatic expressions
3. Accurately translate technical terms
4. Maintain the original paragraph structure

IMPORTANT: You MUST translate and output the entire content in {lang}. Do not keep any text in the original language.`,
    targetLanguage: 'Chinese',
    enabled: true,
    isSystem: true,
  },
  {
    id: 'system_key_points',
    name: 'Key Points',
    content: `Extract the main ideas and key information from this article in bullet points following these requirements:

1. Extract 5-10 key points using concise language
2. Each point should be a complete statement
3. Sort by importance
4. Do not add your own opinions or interpretations

IMPORTANT: You MUST output the entire response in {lang}. Do not use any other language.`,
    targetLanguage: 'Chinese',
    enabled: true,
    isSystem: true,
  },
  {
    id: 'system_action_items',
    name: 'Actions',
    content: `Extract actionable items from this article following these requirements:

1. Identify all executable tasks or recommendations mentioned
2. Describe each action item starting with a verb
3. Arrange in logical execution order
4. If possible, mark priority (High/Medium/Low)

IMPORTANT: You MUST output the entire response in {lang}. Do not use any other language.`,
    targetLanguage: 'Chinese',
    enabled: false,
    isSystem: true,
  },
  {
    id: 'system_explain',
    name: 'Explain',
    content: `Explain the technical content in this article in depth following these requirements:

1. Explain complex technical concepts in an easy-to-understand way
2. Provide relevant background knowledge
3. Analyze relationships between technologies
4. Clarify any ambiguous parts in the original text

IMPORTANT: You MUST output the entire response in {lang}. Do not use any other language.`,
    targetLanguage: 'Chinese',
    enabled: false,
    isSystem: true,
  },
];

export type StorageSettings = {
  serverUrl: string;
  serverUrlList: ServerUrlItem[];
  autoSaveEnabled: boolean;
  autoSaveTweet: boolean;
  contentParser: ContentParserType;
  defaultTargetLanguage: string;
  prompts: Prompt[];
  huntlyShortcutsEnabled: boolean;
}

export const DefaultStorageSettings: StorageSettings = {
  serverUrl: "",
  serverUrlList: [],
  autoSaveEnabled: false,
  autoSaveTweet: false,
  contentParser: "readability",
  defaultTargetLanguage: "Chinese",
  prompts: [],
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
    prompts: items[STORAGE_PROMPTS] || DefaultStorageSettings.prompts,
    huntlyShortcutsEnabled: items[STORAGE_HUNTLY_SHORTCUTS_ENABLED] ?? DefaultStorageSettings.huntlyShortcutsEnabled
  };
}

export async function savePromptsSettings(settings: PromptsSettings): Promise<void> {
  await chrome.storage.sync.set({
    [STORAGE_DEFAULT_TARGET_LANGUAGE]: settings.defaultTargetLanguage,
    [STORAGE_PROMPTS]: settings.prompts,
    [STORAGE_HUNTLY_SHORTCUTS_ENABLED]: settings.huntlyShortcutsEnabled
  });
}

export async function getPromptsSettings(): Promise<PromptsSettings> {
  const items = await chrome.storage.sync.get({
    [STORAGE_DEFAULT_TARGET_LANGUAGE]: DefaultStorageSettings.defaultTargetLanguage,
    [STORAGE_PROMPTS]: DefaultStorageSettings.prompts,
    [STORAGE_HUNTLY_SHORTCUTS_ENABLED]: DefaultStorageSettings.huntlyShortcutsEnabled
  });

  // Merge system prompts with stored prompts
  const storedPrompts: Prompt[] = items[STORAGE_PROMPTS] || [];
  const now = Date.now();

  // Create a map of stored prompts by ID for quick lookup
  const storedPromptsMap = new Map(storedPrompts.map(p => [p.id, p]));

  // Build the final prompts list: system prompts (with stored overrides) + user prompts
  const mergedPrompts: Prompt[] = [];

  // Add system prompts, using stored values if available
  for (const systemPrompt of SYSTEM_PROMPTS) {
    const stored = storedPromptsMap.get(systemPrompt.id);
    if (stored) {
      // Use stored version but ensure isSystem is true
      mergedPrompts.push({ ...stored, isSystem: true });
    } else {
      // Use default system prompt
      mergedPrompts.push({
        ...systemPrompt,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  // Add user prompts (non-system)
  for (const prompt of storedPrompts) {
    if (!prompt.isSystem) {
      mergedPrompts.push(prompt);
    }
  }

  return {
    defaultTargetLanguage: items[STORAGE_DEFAULT_TARGET_LANGUAGE],
    prompts: mergedPrompts,
    huntlyShortcutsEnabled: items[STORAGE_HUNTLY_SHORTCUTS_ENABLED]
  };
}