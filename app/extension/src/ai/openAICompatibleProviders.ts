import { AIProviderConfig, PROVIDER_REGISTRY } from "./types";

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
