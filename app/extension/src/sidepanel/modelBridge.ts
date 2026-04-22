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
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
} from "@ai-sdk/provider";
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

/**
 * Rewrite each SSE `data:` line in a streaming Chat Completions response so
 * that any `choices[].delta.reasoning` field (used by OpenRouter and a few
 * other OpenAI-compatible providers) is exposed as `reasoning_content`
 * instead — the field name that @ai-sdk/deepseek's chunk schema understands.
 *
 * Non-streaming responses and unrelated lines pass through unchanged.
 */
function rewriteReasoningFieldInSseLine(line: string): string {
  if (!line.startsWith("data:")) return line;
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return line;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return line;
  }

  const choices = (parsed as { choices?: Array<{ delta?: Record<string, unknown> }> })
    ?.choices;
  if (!Array.isArray(choices)) return line;

  let mutated = false;
  for (const choice of choices) {
    const delta = choice?.delta;
    if (
      delta &&
      typeof delta === "object" &&
      typeof delta.reasoning === "string" &&
      typeof delta.reasoning_content !== "string"
    ) {
      delta.reasoning_content = delta.reasoning;
      delete delta.reasoning;
      mutated = true;
    }
  }

  return mutated ? `data: ${JSON.stringify(parsed)}` : line;
}

/**
 * Fetch wrapper that rewrites `reasoning` → `reasoning_content` in each SSE
 * delta so providers like OpenRouter work with @ai-sdk/deepseek's chunk
 * schema. Buffers across chunks to handle line boundaries safely.
 */
const openAICompatibleFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const contentType = response.headers.get("content-type") || "";
  if (!response.body || !contentType.includes("text/event-stream")) {
    return response;
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const transformed = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex !== -1) {
          const rawLine = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
          controller.enqueue(
            encoder.encode(`${rewriteReasoningFieldInSseLine(line)}\n`)
          );
          newlineIndex = buffer.indexOf("\n");
        }
      },
      flush(controller) {
        if (buffer) {
          controller.enqueue(
            encoder.encode(rewriteReasoningFieldInSseLine(buffer))
          );
          buffer = "";
        }
      },
    })
  );

  return new Response(transformed, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

function promptHasFileParts(options: LanguageModelV3CallOptions): boolean {
  return options.prompt.some(
    (message) =>
      message.role === "user" &&
      message.content.some((part) => part.type === "file")
  );
}

function getReasoningDeltaFromRawChunk(rawValue: unknown): string | null {
  const choices = (rawValue as {
    choices?: Array<{ delta?: Record<string, unknown> }>;
  })?.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const delta = choices[0]?.delta;
  if (!delta || typeof delta !== "object") {
    return null;
  }

  if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
    return delta.reasoning_content;
  }

  if (typeof delta.reasoning === "string" && delta.reasoning) {
    return delta.reasoning;
  }

  return null;
}

async function mergeSupportedUrls(
  ...models: LanguageModelV3[]
): Promise<Record<string, RegExp[]>> {
  const merged: Record<string, RegExp[]> = {};

  const supportedUrls = await Promise.all(
    models.map((model) => Promise.resolve(model.supportedUrls))
  );

  for (const urlsByType of supportedUrls) {
    for (const [mediaType, patterns] of Object.entries(urlsByType || {})) {
      merged[mediaType] = [...(merged[mediaType] || []), ...patterns];
    }
  }

  return merged;
}

function createPromptAwareModel(
  defaultModel: LanguageModelV3,
  fileCapableModel: LanguageModelV3
): LanguageModelV3 {
  const resolveModel = (options: LanguageModelV3CallOptions) =>
    promptHasFileParts(options) ? fileCapableModel : defaultModel;

  return {
    specificationVersion: "v3",
    provider: defaultModel.provider,
    modelId: defaultModel.modelId,
    supportedUrls: mergeSupportedUrls(defaultModel, fileCapableModel),
    doGenerate(options) {
      return resolveModel(options).doGenerate(options);
    },
    doStream(options) {
      return resolveModel(options).doStream(options);
    },
  };
}

function createReasoningAwareChatModel(
  baseModel: LanguageModelV3
): LanguageModelV3 {
  const reasoningId = "0";

  const transformStream = (
    stream: ReadableStream<LanguageModelV3StreamPart>,
    shouldForwardRaw: boolean
  ) => {
    let reasoningOpen = false;
    let reasoningClosed = false;

    const closeReasoning = (
      controller: TransformStreamDefaultController<LanguageModelV3StreamPart>
    ) => {
      if (!reasoningOpen || reasoningClosed) {
        return;
      }

      controller.enqueue({
        type: "reasoning-end",
        id: reasoningId,
      });
      reasoningClosed = true;
    };

    return stream.pipeThrough(
      new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>({
        transform(part, controller) {
          if (part.type === "raw") {
            const reasoningDelta = getReasoningDeltaFromRawChunk(part.rawValue);
            if (reasoningDelta) {
              if (!reasoningOpen) {
                reasoningOpen = true;
                controller.enqueue({
                  type: "reasoning-start",
                  id: reasoningId,
                });
              }

              controller.enqueue({
                type: "reasoning-delta",
                id: reasoningId,
                delta: reasoningDelta,
              });
            }

            if (shouldForwardRaw) {
              controller.enqueue(part);
            }
            return;
          }

          if (part.type === "finish" || part.type === "error") {
            closeReasoning(controller);
          }

          controller.enqueue(part);
        },
        flush(controller) {
          closeReasoning(controller);
        },
      })
    );
  };

  return {
    specificationVersion: "v3",
    provider: baseModel.provider,
    modelId: baseModel.modelId,
    supportedUrls: baseModel.supportedUrls,
    doGenerate(options) {
      return baseModel.doGenerate(options);
    },
    async doStream(
      options: LanguageModelV3CallOptions
    ): Promise<LanguageModelV3StreamResult> {
      const result = await baseModel.doStream({
        ...options,
        includeRawChunks: true,
      });

      return {
        ...result,
        stream: transformStream(result.stream, Boolean(options.includeRawChunks)),
      };
    },
  };
}

function createOpenAICompatibleChatModel(
  config: ProviderConfig,
  modelId: string,
  baseUrl: string
): LanguageModelV3 | null {
  if (!baseUrl) return null;

  const provider = createOpenAI({
    apiKey: config.apiKey || "placeholder",
    baseURL: baseUrl,
    fetch: openAICompatibleFetch,
  });

  return createReasoningAwareChatModel(provider.chat(modelId as any));
}

function createOpenAIFormatModel(
  config: ProviderConfig,
  modelId: string,
  baseUrl: string
): LanguageModelV3 | null {
  if (!baseUrl) return null;
  // Only the official OpenAI endpoint supports the Responses API, which is
  // where @ai-sdk/openai extracts reasoning summaries. For all other
  // OpenAI-compatible endpoints (Zhipu, Qwen, MiniMax, Moonshot, OpenRouter
  // via `openai` custom baseURL, Ollama, Azure AI, …), @ai-sdk/openai's
  // Chat Completions path does NOT extract the non-standard
  // `reasoning_content` / `reasoning` delta fields these providers use to
  // stream thinking content — so the UI never sees any reasoning parts.
  //
  // Route those through DeepSeek's chat model instead: it speaks the same
  // OpenAI Chat Completions wire format (POST /chat/completions with the
  // same request body and Bearer auth), but additionally parses
  // `reasoning_content` deltas into reasoning stream parts. A fetch wrapper
  // normalises the `reasoning` field used by OpenRouter/others into
  // `reasoning_content` so a single code path covers both conventions.
  if (config.type === "openai" && isOfficialOpenAIBaseUrl(baseUrl)) {
    const provider = createOpenAI({
      apiKey: config.apiKey || "placeholder",
      baseURL: baseUrl,
    });
    return provider.responses(modelId);
  }

  const provider = createDeepSeek({
    apiKey: config.apiKey || "placeholder",
    baseURL: baseUrl,
    fetch: openAICompatibleFetch,
  });
  const fileCapableModel = createOpenAICompatibleChatModel(
    config,
    modelId,
    baseUrl
  );
  const defaultModel = provider(modelId);

  return fileCapableModel
    ? createPromptAwareModel(defaultModel, fileCapableModel)
    : defaultModel;
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
