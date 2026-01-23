export const STORAGE_SERVER_URL = "serverUrl";
export const STORAGE_SERVER_URL_LIST = "serverUrlList";
export const STORAGE_AUTO_SAVE_ENABLED = "autoSaveEnabled";
export const STORAGE_AUTO_SAVE_TWEET = "autoSaveTweet";
export const STORAGE_AUTO_SAVE_TWEET_MIN_LIKES = "autoSaveTweetMinLikes";

export type ServerUrlItem = {
  url: string,
}

export type StorageSettings = {
  serverUrl: string;
  serverUrlList: ServerUrlItem[];
  autoSaveEnabled: boolean;
  autoSaveTweet: boolean;
  autoSaveTweetMinLikes: number;
}

export const DefaultStorageSettings: StorageSettings = {
  serverUrl: "",
  serverUrlList: [],
  autoSaveEnabled: false,
  autoSaveTweet: false,
  autoSaveTweetMinLikes: 0
}

export async function readSyncStorageSettings(): Promise<StorageSettings> {
  const items = await chrome.storage.sync.get(DefaultStorageSettings);
  return {
    serverUrl: items[STORAGE_SERVER_URL] || DefaultStorageSettings.serverUrl,
    serverUrlList: items[STORAGE_SERVER_URL_LIST] || DefaultStorageSettings.serverUrlList,
    autoSaveEnabled: items[STORAGE_AUTO_SAVE_ENABLED] ?? DefaultStorageSettings.autoSaveEnabled,
    autoSaveTweet: items[STORAGE_AUTO_SAVE_TWEET] ?? DefaultStorageSettings.autoSaveTweet,
    autoSaveTweetMinLikes: items[STORAGE_AUTO_SAVE_TWEET_MIN_LIKES] ?? DefaultStorageSettings.autoSaveTweetMinLikes
  };
}