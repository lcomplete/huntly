/**
 * Model bridge: create AI SDK LanguageModel instances from provider configurations.
 *
 * Providers fall into one of three wire-format families:
 *   - `openai`    : OpenAI Chat/Responses API and OpenAI-compatible endpoints
 *                   (Ollama, Qwen, Zhipu, MiniMax, Azure AI …)
 *   - `anthropic` : Anthropic Messages API (Claude, and third-party providers
 *                   that expose an Anthropic-compatible endpoint)
 *   - `google`    : Gemini API
 *
 * Providers with a dedicated AI SDK factory (OpenAI, Anthropic, Google,
 * DeepSeek, Groq, Azure OpenAI) use it directly — the native SDK understands
 * provider-specific quirks such as reasoning extraction and thinking flags,
 * which plain @ai-sdk/openai does not handle for OpenAI-compatible endpoints.
 * The remaining providers route through one of the two compatible formats,
 * chosen via {@link getEffectiveApiFormat} (honours user override when the
 * provider meta allows it).
 */

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGroq } from "@ai-sdk/groq";
import { createAzure } from "@ai-sdk/azure";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import {
  getEffectiveApiFormat,
  PROVIDER_REGISTRY,
  ProviderType,
} from "../ai/types";
import { getOllamaOpenAIBaseUrl } from "../ai/openAICompatibleProviders";
import type { HuntlyModelInfo } from "./types";

export interface ProviderConfig {
  type: string;
  apiKey?: string;
  baseUrl?: string;
  enabledModels: string[];
  enabled: boolean;
  apiFormat?: "openai" | "anthropic";
}

const ANTHROPIC_BROWSER_HEADERS = {
  "anthropic-dangerous-direct-browser-access": "true",
};

function resolveBaseUrl(config: ProviderConfig): string {
  const meta = PROVIDER_REGISTRY[config.type as ProviderType];
  if (config.type === "ollama") {
    return getOllamaOpenAIBaseUrl(config.baseUrl);
  }
  return config.baseUrl || meta?.defaultBaseUrl || "";
}

function isOfficialOpenAIBaseUrl(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname === "api.openai.com";
  } catch {
    return false;
  }
}

function createOpenAIFormatModel(
  config: ProviderConfig,
  modelId: string,
  baseUrl: string
): LanguageModelV3 | null {
  if (!baseUrl) return null;
  const provider = createOpenAI({
    apiKey: config.apiKey || "placeholder",
    baseURL: baseUrl,
  });
  // Only the official OpenAI endpoint supports the Responses API.
  return config.type === "openai" && isOfficialOpenAIBaseUrl(baseUrl)
    ? provider.responses(modelId)
    : provider.chat(modelId);
}

function createAnthropicFormatModel(
  config: ProviderConfig,
  modelId: string,
  baseUrl: string
): LanguageModelV3 | null {
  const provider = createAnthropic({
    apiKey: config.apiKey || "",
    baseURL: baseUrl || undefined,
    headers: ANTHROPIC_BROWSER_HEADERS,
  });
  return provider(modelId);
}

/**
 * Create an AI SDK LanguageModelV3 instance from a Huntly provider configuration.
 */
export function createLanguageModel(
  config: ProviderConfig,
  modelId: string
): LanguageModelV3 | null {
  const meta = PROVIDER_REGISTRY[config.type as ProviderType];
  if (!meta) return null;

  // Providers with dedicated SDK factories — format is fixed.
  // Using the dedicated SDK is important for providers like DeepSeek/Groq
  // because their SDK extracts `reasoning_content` into reasoning stream
  // parts and honours `providerOptions.deepseek`/`providerOptions.groq`
  // (thinking mode). Plain @ai-sdk/openai would silently drop both.
  if (config.type === "google") {
    const provider = createGoogleGenerativeAI({
      apiKey: config.apiKey || "",
      baseURL: config.baseUrl || meta.defaultBaseUrl || undefined,
    });
    return provider(modelId);
  }

  if (config.type === "deepseek") {
    const provider = createDeepSeek({
      apiKey: config.apiKey || "",
      baseURL: config.baseUrl || undefined,
    });
    return provider(modelId);
  }

  if (config.type === "groq") {
    const provider = createGroq({
      apiKey: config.apiKey || "",
      baseURL: config.baseUrl || undefined,
    });
    return provider(modelId);
  }

  if (config.type === "azure-openai") {
    if (!config.baseUrl) return null;
    const provider = createAzure({
      apiKey: config.apiKey || "",
      baseURL: config.baseUrl,
    });
    return provider(modelId);
  }

  // Everything else routes through an OpenAI- or Anthropic-compatible wire
  // format. The effective format comes from user choice (for flexible
  // providers) or the provider's native format otherwise.
  const format = getEffectiveApiFormat({
    type: config.type as ProviderType,
    apiFormat: config.apiFormat,
  });
  const baseUrl = resolveBaseUrl(config);

  return format === "anthropic"
    ? createAnthropicFormatModel(config, modelId, baseUrl)
    : createOpenAIFormatModel(config, modelId, baseUrl);
}

/**
 * Create a unique key for a model entry (for selection persistence).
 */
export function getModelKey(info: HuntlyModelInfo): string {
  return `${info.provider}:${info.modelId}`;
}

/**
 * Find a model by its key string.
 */
export function findModelByKey(
  models: HuntlyModelInfo[],
  key: string | null | undefined
): HuntlyModelInfo | null {
  if (!key) return null;
  return models.find((m) => getModelKey(m) === key) || null;
}

/**
 * Resolve which model to use: requested → global default → first available.
 */
export function resolveModelSelection(
  models: HuntlyModelInfo[],
  requestedKey: string | null | undefined,
  globalDefaultKey: string | null | undefined
): { modelInfo: HuntlyModelInfo | null; resolvedKey: string | null } {
  const requested = findModelByKey(models, requestedKey);
  if (requested) {
    return { modelInfo: requested, resolvedKey: getModelKey(requested) };
  }

  const globalDefault = findModelByKey(models, globalDefaultKey);
  if (globalDefault) {
    return {
      modelInfo: globalDefault,
      resolvedKey: getModelKey(globalDefault),
    };
  }

  if (models.length > 0) {
    return { modelInfo: models[0], resolvedKey: getModelKey(models[0]) };
  }

  return { modelInfo: null, resolvedKey: null };
}
