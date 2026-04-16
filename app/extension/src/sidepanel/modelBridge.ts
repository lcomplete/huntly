/**
 * Model bridge: create AI SDK LanguageModel instances from provider configurations.
 *
 * Maps Huntly's AIProviderConfig → AI SDK LanguageModelV3 so the
 * ToolLoopAgent can use any configured provider.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGroq } from "@ai-sdk/groq";
import { createAzure } from "@ai-sdk/azure";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { HuntlyModelInfo } from "./types";
import {
  createQwenCompatibleFetch,
  wrapQwenModelForReasoning,
} from "./qwenCompatibility";

// ---------------------------------------------------------------------------
// Provider type → AI SDK factory mapping
// ---------------------------------------------------------------------------

interface ProviderMapping {
  factory:
    | "openai"
    | "anthropic"
    | "google"
    | "deepseek"
    | "groq"
    | "azure"
    | "openai-compat";
  defaultBaseUrl: string;
}

const PROVIDER_MAP: Record<string, ProviderMapping> = {
  openai: { factory: "openai", defaultBaseUrl: "https://api.openai.com/v1" },
  anthropic: {
    factory: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
  },
  google: {
    factory: "google",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  },
  deepseek: {
    factory: "deepseek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
  },
  groq: { factory: "groq", defaultBaseUrl: "https://api.groq.com/openai/v1" },
  ollama: {
    factory: "openai-compat",
    defaultBaseUrl: "http://localhost:11434/v1",
  },
  qwen: {
    factory: "openai-compat",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  zhipu: {
    factory: "openai-compat",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
  },
  minimax: {
    factory: "openai-compat",
    defaultBaseUrl: "https://api.minimax.chat/v1",
  },
  "azure-openai": { factory: "azure", defaultBaseUrl: "" },
  "azure-ai": { factory: "openai-compat", defaultBaseUrl: "" },
};

function isOfficialOpenAIBaseUrl(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname === "api.openai.com";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Create an AI SDK model from provider info
// ---------------------------------------------------------------------------

export interface ProviderConfig {
  type: string;
  apiKey?: string;
  baseUrl?: string;
  enabledModels: string[];
  enabled: boolean;
}

/**
 * Create an AI SDK LanguageModelV3 instance from a Huntly provider configuration.
 */
export function createLanguageModel(
  config: ProviderConfig,
  modelId: string
): LanguageModelV3 | null {
  const mapping = PROVIDER_MAP[config.type];
  if (!mapping) return null;

  const baseUrl = config.baseUrl || mapping.defaultBaseUrl;
  if (
    !baseUrl &&
    (config.type === "azure-openai" || config.type === "azure-ai")
  ) {
    return null;
  }

  const apiKey = config.apiKey || "";

  switch (mapping.factory) {
    case "openai": {
      const provider = createOpenAI({ apiKey, baseURL: baseUrl });
      return isOfficialOpenAIBaseUrl(baseUrl)
        ? provider.responses(modelId)
        : provider.chat(modelId);
    }
    case "anthropic": {
      const provider = createAnthropic({
        apiKey,
        baseURL: baseUrl,
        headers: { "anthropic-dangerous-direct-browser-access": "true" },
      });
      return provider(modelId);
    }
    case "google": {
      const provider = createGoogleGenerativeAI({ apiKey, baseURL: baseUrl });
      return provider(modelId);
    }
    case "deepseek": {
      const provider = createDeepSeek({ apiKey, baseURL: baseUrl });
      return provider(modelId);
    }
    case "groq": {
      const provider = createGroq({ apiKey, baseURL: baseUrl });
      return provider(modelId);
    }
    case "azure": {
      const provider = createAzure({ apiKey, baseURL: baseUrl });
      return provider(modelId);
    }
    case "openai-compat": {
      // Use OpenAI provider for OpenAI-compatible endpoints
      const provider = createOpenAI({
        apiKey: apiKey || "placeholder",
        baseURL: baseUrl,
        fetch: config.type === "qwen" ? createQwenCompatibleFetch() : undefined,
      });
      const model = provider.chat(modelId);
      return config.type === "qwen" ? wrapQwenModelForReasoning(model) : model;
    }
    default:
      return null;
  }
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
