import {
  AIProviderConfig,
  AIProvidersStorage,
  DEFAULT_AI_STORAGE,
  PROVIDER_ORDER,
  ProviderType,
} from './types';
import { getApiBaseUrl } from '../services';

const AI_PROVIDERS_STORAGE_KEY = 'aiProviders';

export async function getAIProvidersStorage(): Promise<AIProvidersStorage> {
  const result = await chrome.storage.local.get(AI_PROVIDERS_STORAGE_KEY);
  const stored = result[AI_PROVIDERS_STORAGE_KEY];
  if (!stored) {
    return DEFAULT_AI_STORAGE;
  }
  return {
    ...DEFAULT_AI_STORAGE,
    ...stored,
    providers: {
      ...DEFAULT_AI_STORAGE.providers,
      ...(stored.providers || {}),
    },
  };
}

export async function saveAIProvidersStorage(
  storage: AIProvidersStorage
): Promise<void> {
  await chrome.storage.local.set({ [AI_PROVIDERS_STORAGE_KEY]: storage });
}

export async function getProviderConfig(
  type: ProviderType
): Promise<AIProviderConfig | null> {
  const storage = await getAIProvidersStorage();
  return storage.providers[type] || null;
}

export async function saveProviderConfig(
  type: ProviderType,
  config: AIProviderConfig
): Promise<void> {
  const storage = await getAIProvidersStorage();
  storage.providers[type] = {
    ...config,
    updatedAt: Date.now(),
  };
  await saveAIProvidersStorage(storage);
}

export async function deleteProviderConfig(type: ProviderType): Promise<void> {
  const storage = await getAIProvidersStorage();
  storage.providers[type] = null;
  if (storage.defaultProvider === type) {
    storage.defaultProvider = null;
  }
  await saveAIProvidersStorage(storage);
}

export async function setDefaultProvider(
  type: ProviderType | null
): Promise<void> {
  const storage = await getAIProvidersStorage();
  storage.defaultProvider = type;
  await saveAIProvidersStorage(storage);
}

export async function getDefaultProvider(): Promise<AIProviderConfig | null> {
  const storage = await getAIProvidersStorage();

  // If a default provider is explicitly set, use it
  if (storage.defaultProvider) {
    const config = storage.providers[storage.defaultProvider];
    if (config?.enabled) {
      return config;
    }
  }

  // Otherwise, find the first enabled provider in PROVIDER_ORDER
  for (const type of PROVIDER_ORDER) {
    const config = storage.providers[type];
    if (config?.enabled) {
      return config;
    }
  }

  return null;
}

export async function getAllEnabledProviders(): Promise<AIProviderConfig[]> {
  const storage = await getAIProvidersStorage();

  // Return enabled providers in PROVIDER_ORDER
  return PROVIDER_ORDER
    .map((type) => storage.providers[type])
    .filter((p): p is AIProviderConfig => p !== null && p.enabled);
}

/**
 * Check if a provider is available (enabled and properly configured)
 * For huntly-server, checks if server URL is configured
 * For other providers, checks if they are enabled
 */
export async function isProviderAvailable(type: ProviderType): Promise<boolean> {
  if (type === 'huntly-server') {
    const serverUrl = await getApiBaseUrl();
    return !!serverUrl;
  }

  const storage = await getAIProvidersStorage();
  const config = storage.providers[type];
  return config?.enabled ?? false;
}

/**
 * Get all available provider types in order
 * This considers huntly-server's special case (requires server URL)
 */
export async function getAvailableProviderTypes(): Promise<ProviderType[]> {
  const storage = await getAIProvidersStorage();
  const serverUrl = await getApiBaseUrl();

  return PROVIDER_ORDER.filter((type) => {
    if (type === 'huntly-server') {
      return !!serverUrl;
    }
    const config = storage.providers[type];
    return config?.enabled ?? false;
  });
}

/**
 * Get the effective default provider type
 * If a default is set and available, use it
 * Otherwise, return the first available provider
 * Returns null if no provider is available
 */
export async function getEffectiveDefaultProviderType(): Promise<ProviderType | null> {
  const storage = await getAIProvidersStorage();

  // If a default provider is explicitly set, check if it's available
  if (storage.defaultProvider) {
    const isAvailable = await isProviderAvailable(storage.defaultProvider);
    if (isAvailable) {
      return storage.defaultProvider;
    }
  }

  // Otherwise, find the first available provider in PROVIDER_ORDER
  const availableProviders = await getAvailableProviderTypes();
  return availableProviders.length > 0 ? availableProviders[0] : null;
}
