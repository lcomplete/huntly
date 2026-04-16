import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";
import {
  ReadableStream as NodeReadableStream,
  TransformStream as NodeTransformStream,
} from "stream/web";
import {
  applyQwenThinkingToRequestBody,
  createQwenReasoningStream,
  extractQwenReasoningDelta,
} from "../sidepanel/qwenCompatibility";

beforeAll(() => {
  Object.assign(globalThis, {
    ReadableStream: NodeReadableStream,
    TransformStream: NodeTransformStream,
  });
});

async function collectStream(
  stream: ReadableStream<LanguageModelV3StreamPart>
): Promise<LanguageModelV3StreamPart[]> {
  const reader = stream.getReader();
  const parts: LanguageModelV3StreamPart[] = [];

  while (true) {
    const result = await reader.read();
    if (result.done) break;
    parts.push(result.value);
  }

  return parts;
}

describe("qwenCompatibility", () => {
  it("maps thinking mode to DashScope request body fields", () => {
    const body = applyQwenThinkingToRequestBody(
      JSON.stringify({
        model: "qwen3.5-plus",
        stream: true,
        reasoning_effort: "high",
      }),
      true
    );

    expect(JSON.parse(String(body))).toEqual({
      model: "qwen3.5-plus",
      stream: true,
      enable_thinking: true,
    });
  });

  it("extracts reasoning_content from Qwen raw stream chunks", () => {
    const delta = extractQwenReasoningDelta({
      choices: [
        {
          delta: {
            content: null,
            reasoning_content: "Analyze the request.",
          },
        },
      ],
    });

    expect(delta).toBe("Analyze the request.");
  });

  it("converts Qwen raw reasoning chunks into AI SDK reasoning events", async () => {
    const input = new ReadableStream<LanguageModelV3StreamPart>({
      start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] });
        controller.enqueue({
          type: "raw",
          rawValue: {
            choices: [{ delta: { reasoning_content: "Think" } }],
          },
        });
        controller.enqueue({
          type: "raw",
          rawValue: {
            choices: [{ delta: { reasoning_content: " more" } }],
          },
        });
        controller.enqueue({ type: "text-start", id: "0" });
        controller.enqueue({ type: "text-delta", id: "0", delta: "Answer" });
        controller.close();
      },
    });

    const parts = await collectStream(createQwenReasoningStream(input, false));

    expect(parts).toEqual([
      { type: "stream-start", warnings: [] },
      { type: "reasoning-start", id: "qwen-reasoning-0" },
      {
        type: "reasoning-delta",
        id: "qwen-reasoning-0",
        delta: "Think",
      },
      {
        type: "reasoning-delta",
        id: "qwen-reasoning-0",
        delta: " more",
      },
      { type: "reasoning-end", id: "qwen-reasoning-0" },
      { type: "text-start", id: "0" },
      { type: "text-delta", id: "0", delta: "Answer" },
    ]);
  });
});
