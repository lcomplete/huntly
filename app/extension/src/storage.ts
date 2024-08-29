export const STORAGE_SERVER_URL = "serverUrl";
export const STORAGE_SERVER_URL_LIST = "serverUrlList";
export const STORAGE_AUTO_SAVE_ENABLED = "autoSaveEnabled";
export const STORAGE_AUTO_SAVE_MIN_SCORE = "autoSaveMinScore";
export const STORAGE_AUTO_SAVE_MIN_CONTENT_LENGTH = "autoSaveMinContentLength";
export const STORAGE_AUTO_SAVE_TWEET = "autoSaveTweet";

export type ServerUrlItem = {
  url: string,
}

export type StorageSettings = {
  serverUrl: string;
  serverUrlList: ServerUrlItem[];
  autoSaveEnabled: boolean;
  autoSaveMinScore: number;
  autoSaveMinContentLength: number;
  autoSaveTweet: boolean;
}

export const DefaultStorageSettings: StorageSettings = {
  serverUrl: "",
  serverUrlList: [],
  autoSaveEnabled: true,
  autoSaveMinScore: 20,
  autoSaveMinContentLength: 40,
  autoSaveTweet: true
}

export async function readSyncStorageSettings(): Promise<StorageSettings> {
  const items = await chrome.storage.sync.get(DefaultStorageSettings);
  return {
    serverUrl: items[STORAGE_SERVER_URL] || DefaultStorageSettings.serverUrl,
    serverUrlList: items[STORAGE_SERVER_URL_LIST] || DefaultStorageSettings.serverUrlList,
    autoSaveEnabled: items[STORAGE_AUTO_SAVE_ENABLED],
    autoSaveMinScore: items[STORAGE_AUTO_SAVE_MIN_SCORE] || DefaultStorageSettings.autoSaveMinScore,
    autoSaveMinContentLength: items[STORAGE_AUTO_SAVE_MIN_CONTENT_LENGTH] || DefaultStorageSettings.autoSaveMinContentLength,
    autoSaveTweet: items[STORAGE_AUTO_SAVE_TWEET]
  };
}