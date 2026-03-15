import {
  buildOpenAICompatibleChatCompletionBody,
  extractOpenAICompatibleStreamDelta,
} from "../ai/openAICompatibleStream";

describe("openAICompatibleStream", () => {
  it("extracts reasoning_content deltas from OpenAI-compatible chunks", () => {
    const delta = extractOpenAICompatibleStreamDelta(
      '{"choices":[{"delta":{"content":null,"reasoning_content":"Analyze"},"finish_reason":null,"index":0}]}'
    );

    expect(delta.reasoningDelta).toBe("Analyze");
    expect(delta.contentDelta).toBe("");
    expect(delta.done).toBe(false);
  });

  it("extracts content deltas from OpenAI-compatible chunks", () => {
    const delta = extractOpenAICompatibleStreamDelta(
      '{"choices":[{"delta":{"content":"Answer","reasoning_content":null},"finish_reason":null,"index":0}]}'
    );

    expect(delta.contentDelta).toBe("Answer");
    expect(delta.reasoningDelta).toBe("");
    expect(delta.done).toBe(false);
  });

  it("handles done sentinel", () => {
    const delta = extractOpenAICompatibleStreamDelta("[DONE]");

    expect(delta.done).toBe(true);
  });

  it("includes request body extras when building request payload", () => {
    const body = buildOpenAICompatibleChatCompletionBody({
      modelId: "qwen3-max",
      systemPrompt: "You are helpful",
      userPrompt: "Translate this",
      maxTokens: 2048,
      requestBodyExtras: {
        enable_thinking: false,
      },
    });

    expect(body).toEqual({
      model: "qwen3-max",
      stream: true,
      max_tokens: 2048,
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Translate this" },
      ],
      enable_thinking: false,
    });
  });
});
