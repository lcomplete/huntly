import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
} from "@ai-sdk/provider";

const QWEN_ENABLE_THINKING_HEADER = "x-huntly-qwen-enable-thinking";
const QWEN_REASONING_ID = "qwen-reasoning-0";

type HeadersLike = NonNullable<RequestInit["headers"]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readHeader(
  headers: HeadersLike | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined;

  const lowerName = name.toLowerCase();
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  if (Array.isArray(headers)) {
    const entry = headers.find(([key]) => key.toLowerCase() === lowerName);
    return entry?.[1];
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  return undefined;
}

function removeHeader(
  headers: HeadersLike | undefined,
  name: string
): HeadersLike | undefined {
  if (!headers) return headers;

  const lowerName = name.toLowerCase();
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const nextHeaders = new Headers(headers);
    nextHeaders.delete(name);
    return nextHeaders;
  }

  if (Array.isArray(headers)) {
    return headers.filter(([key]) => key.toLowerCase() !== lowerName);
  }

  const nextHeaders = { ...headers };
  for (const key of Object.keys(nextHeaders)) {
    if (key.toLowerCase() === lowerName) {
      delete nextHeaders[key];
    }
  }
  return nextHeaders;
}

function getQwenThinkingEnabled(options: LanguageModelV3CallOptions): boolean {
  const qwenOptions = options.providerOptions?.qwen;
  const explicit = qwenOptions?.enableThinking;

  if (typeof explicit === "boolean") {
    return explicit;
  }

  const openaiOptions = options.providerOptions?.openai;
  const reasoningEffort = openaiOptions?.reasoningEffort;

  return typeof reasoningEffort === "string" && reasoningEffort !== "none";
}

function withQwenThinkingHeader(
  options: LanguageModelV3CallOptions,
  enableThinking: boolean
): LanguageModelV3CallOptions {
  return {
    ...options,
    headers: {
      ...options.headers,
      [QWEN_ENABLE_THINKING_HEADER]: String(enableThinking),
    },
  };
}

export function applyQwenThinkingToRequestBody(
  body: BodyInit | null | undefined,
  enableThinking: boolean
): BodyInit | null | undefined {
  if (typeof body !== "string") return body;

  try {
    const parsed = JSON.parse(body);
    if (!isRecord(parsed)) return body;

    parsed.enable_thinking = enableThinking;
    delete parsed.reasoning_effort;

    return JSON.stringify(parsed);
  } catch {
    return body;
  }
}

export function createQwenCompatibleFetch(
  baseFetch: typeof globalThis.fetch = globalThis.fetch.bind(globalThis)
): typeof globalThis.fetch {
  return (input, init) => {
    const enableThinking = readHeader(
      init?.headers,
      QWEN_ENABLE_THINKING_HEADER
    );

    if (enableThinking === undefined) {
      return baseFetch(input, init);
    }

    const nextInit: RequestInit = {
      ...init,
      headers: removeHeader(init?.headers, QWEN_ENABLE_THINKING_HEADER),
      body: applyQwenThinkingToRequestBody(
        init?.body ?? null,
        enableThinking === "true"
      ),
    };

    return baseFetch(input, nextInit);
  };
}

function getFirstChoice(rawValue: unknown): Record<string, unknown> | null {
  const choices = isRecord(rawValue) ? rawValue.choices : undefined;
  if (!Array.isArray(choices)) return null;

  const choice = choices[0];
  return isRecord(choice) ? choice : null;
}

function getReasoningText(value: unknown): string {
  if (!isRecord(value)) return "";

  const reasoningContent = value.reasoning_content;
  if (typeof reasoningContent === "string") return reasoningContent;

  const reasoning = value.reasoning;
  return typeof reasoning === "string" ? reasoning : "";
}

export function extractQwenReasoningDelta(rawValue: unknown): string {
  const choice = getFirstChoice(rawValue);
  const delta = choice?.delta;
  return getReasoningText(delta);
}

function extractQwenReasoningFromGenerateResult(
  result: LanguageModelV3GenerateResult
): string {
  const choice = getFirstChoice(result.response?.body);
  return getReasoningText(choice?.message);
}

function shouldEndReasoningBefore(part: LanguageModelV3StreamPart): boolean {
  switch (part.type) {
    case "text-start":
    case "tool-input-start":
    case "tool-call":
    case "tool-result":
    case "file":
    case "source":
    case "finish":
    case "error":
      return true;
    default:
      return false;
  }
}

export function createQwenReasoningStream(
  stream: ReadableStream<LanguageModelV3StreamPart>,
  includeRawChunks: boolean
): ReadableStream<LanguageModelV3StreamPart> {
  let reasoningActive = false;

  return stream.pipeThrough(
    new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>({
      transform(part, controller) {
        if (part.type === "raw") {
          const reasoningDelta = extractQwenReasoningDelta(part.rawValue);

          if (reasoningDelta) {
            if (!reasoningActive) {
              controller.enqueue({
                type: "reasoning-start",
                id: QWEN_REASONING_ID,
              });
              reasoningActive = true;
            }

            controller.enqueue({
              type: "reasoning-delta",
              id: QWEN_REASONING_ID,
              delta: reasoningDelta,
            });
          }

          if (includeRawChunks) {
            controller.enqueue(part);
          }
          return;
        }

        if (reasoningActive && shouldEndReasoningBefore(part)) {
          controller.enqueue({
            type: "reasoning-end",
            id: QWEN_REASONING_ID,
          });
          reasoningActive = false;
        }

        controller.enqueue(part);
      },
      flush(controller) {
        if (reasoningActive) {
          controller.enqueue({
            type: "reasoning-end",
            id: QWEN_REASONING_ID,
          });
        }
      },
    })
  );
}

export function wrapQwenModelForReasoning(
  model: LanguageModelV3
): LanguageModelV3 {
  return {
    specificationVersion: model.specificationVersion,
    provider: model.provider,
    modelId: model.modelId,
    supportedUrls: model.supportedUrls,
    async doGenerate(options) {
      const result = await model.doGenerate(
        withQwenThinkingHeader(options, getQwenThinkingEnabled(options))
      );
      const reasoning = extractQwenReasoningFromGenerateResult(result);

      if (
        !reasoning.trim() ||
        result.content.some((part) => part.type === "reasoning")
      ) {
        return result;
      }

      return {
        ...result,
        content: [
          { type: "reasoning" as const, text: reasoning },
          ...result.content,
        ],
      };
    },
    async doStream(options) {
      const result = await model.doStream({
        ...withQwenThinkingHeader(options, getQwenThinkingEnabled(options)),
        includeRawChunks: true,
      });

      return {
        ...result,
        stream: createQwenReasoningStream(
          result.stream,
          Boolean(options.includeRawChunks)
        ),
      };
    },
  };
}
