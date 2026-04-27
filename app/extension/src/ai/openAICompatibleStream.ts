import { combineUrl } from "../utils";

export interface OpenAICompatibleStreamDelta {
  contentDelta: string;
  reasoningDelta: string;
  done: boolean;
}

interface StreamOpenAICompatibleChatCompletionOptions {
  apiKey: string;
  baseUrl: string;
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  requestBodyExtras?: Record<string, unknown>;
  abortSignal: AbortSignal;
  onDelta: (delta: OpenAICompatibleStreamDelta) => void;
}

function buildOpenAICompatibleChatCompletionBody({
  modelId,
  systemPrompt,
  userPrompt,
  maxTokens,
  requestBodyExtras = {},
}: Pick<
  StreamOpenAICompatibleChatCompletionOptions,
  "modelId" | "systemPrompt" | "userPrompt" | "maxTokens" | "requestBodyExtras"
>) {
  return {
    model: modelId,
    stream: true,
    max_tokens: maxTokens,
    messages: [
      ...(systemPrompt.trim()
        ? [{ role: "system", content: systemPrompt }]
        : []),
      { role: "user", content: userPrompt },
    ],
    ...requestBodyExtras,
  };
}

function extractOpenAICompatibleStreamDelta(
  data: string
): OpenAICompatibleStreamDelta {
  if (data.trim() === "[DONE]") {
    return {
      contentDelta: "",
      reasoningDelta: "",
      done: true,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return {
      contentDelta: "",
      reasoningDelta: "",
      done: false,
    };
  }

  const delta =
    (parsed as { choices?: Array<{ delta?: Record<string, unknown> }> })
      ?.choices?.[0]?.delta ?? {};

  return {
    contentDelta: typeof delta.content === "string" ? delta.content : "",
    reasoningDelta:
      typeof delta.reasoning_content === "string"
        ? delta.reasoning_content
        : typeof delta.reasoning === "string"
          ? delta.reasoning
          : "",
    done: false,
  };
}

export async function streamOpenAICompatibleChatCompletion({
  apiKey,
  baseUrl,
  modelId,
  systemPrompt,
  userPrompt,
  maxTokens,
  requestBodyExtras,
  abortSignal,
  onDelta,
}: StreamOpenAICompatibleChatCompletionOptions): Promise<void> {
  const response = await fetch(combineUrl(baseUrl, "chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(
      buildOpenAICompatibleChatCompletionBody({
        modelId,
        systemPrompt,
        userPrompt,
        maxTokens,
        requestBodyExtras,
      })
    ),
    signal: abortSignal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      errorText ||
        `HTTP error! status: ${response.status} ${response.statusText}`
    );
  }

  if (!response.body) {
    throw new Error("No response body available");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines: string[] = [];
  let done = false;

  const processEvent = () => {
    if (dataLines.length === 0) {
      return;
    }

    const eventData = dataLines.join("\n");
    dataLines = [];

    const delta = extractOpenAICompatibleStreamDelta(eventData);
    if (delta.done) {
      done = true;
      return;
    }

    onDelta(delta);
  };

  const processBuffer = () => {
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) {
        line = line.slice(0, -1);
      }

      if (line === "") {
        processEvent();
      } else if (line.startsWith("data:")) {
        dataLines.push(
          line.startsWith("data: ") ? line.slice(6) : line.slice(5)
        );
      }

      if (done) {
        return;
      }

      newlineIndex = buffer.indexOf("\n");
    }
  };

  try {
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      processBuffer();
    }

    buffer += decoder.decode();
    if (buffer.length > 0) {
      buffer += "\n";
      processBuffer();
    }
    processEvent();
  } finally {
    reader.releaseLock();
  }
}