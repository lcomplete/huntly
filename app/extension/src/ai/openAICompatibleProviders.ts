import {
  AIProviderConfig,
  getEffectiveApiFormat,
  PROVIDER_REGISTRY,
} from "./types";

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getProviderBaseUrl(config: AIProviderConfig): string | undefined {
  return (
    config.baseUrl ||
    PROVIDER_REGISTRY[config.type]?.defaultBaseUrl ||
    undefined
  );
}

export function usesRawOpenAICompatibleStream(
  config: AIProviderConfig
): boolean {
  const format = getEffectiveApiFormat({
    type: config.type,
    apiFormat: config.apiFormat,
  });
  if (format !== "openai") {
    return false;
  }

  if (PROVIDER_REGISTRY[config.type]?.requiresRawOpenAICompatibleStream) {
    return true;
  }

  return false;
}

/**
 * @deprecated use {@link getProviderBaseUrl}. Kept for call sites still being migrated.
 */
export const getOpenAICompatibleBaseUrl = getProviderBaseUrl;

export function getOllamaBaseUrl(baseUrl?: string): string {
  const normalizedBaseUrl = trimTrailingSlash(
    baseUrl || PROVIDER_REGISTRY.ollama.defaultBaseUrl
  );

  return normalizedBaseUrl.endsWith("/v1")
    ? normalizedBaseUrl.slice(0, -3)
    : normalizedBaseUrl;
}

export function getOllamaOpenAIBaseUrl(baseUrl?: string): string {
  return `${getOllamaBaseUrl(baseUrl)}/v1`;
}
