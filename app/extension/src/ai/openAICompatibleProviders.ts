import { AIProviderConfig, ProviderType, PROVIDER_REGISTRY } from "./types";

const ALWAYS_RAW_OPENAI_COMPATIBLE_PROVIDERS = new Set<ProviderType>([
  "qwen",
  "zhipu",
  "minimax",
]);

export function isDashScopeCompatibleBaseUrl(baseUrl?: string): boolean {
  const normalizedBaseUrl = baseUrl?.toLowerCase() || "";

  return (
    normalizedBaseUrl.includes("dashscope.aliyuncs.com/compatible-mode") ||
    normalizedBaseUrl.includes("dashscope-intl.aliyuncs.com/compatible-mode")
  );
}

export function usesRawOpenAICompatibleStream(
  config: AIProviderConfig
): boolean {
  if (ALWAYS_RAW_OPENAI_COMPATIBLE_PROVIDERS.has(config.type)) {
    return true;
  }

  if (config.type === "openai") {
    return isDashScopeCompatibleBaseUrl(getOpenAICompatibleBaseUrl(config));
  }

  return false;
}

export function getOpenAICompatibleBaseUrl(
  config: AIProviderConfig
): string | undefined {
  return config.baseUrl || PROVIDER_REGISTRY[config.type]?.defaultBaseUrl || undefined;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getOllamaBaseUrl(baseUrl?: string): string {
  const normalizedBaseUrl = trimTrailingSlash(
    baseUrl || PROVIDER_REGISTRY.ollama.defaultBaseUrl
  );

  return normalizedBaseUrl.endsWith("/v1")
    ? normalizedBaseUrl.slice(0, -3)
    : normalizedBaseUrl;
}

export function getOllamaOpenAIBaseUrl(baseUrl?: string): string {
  const normalizedBaseUrl = getOllamaBaseUrl(baseUrl);

  return `${normalizedBaseUrl}/v1`;
}
