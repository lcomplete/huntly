import {
  getOpenAICompatibleBaseUrl,
  getOllamaBaseUrl,
  getOllamaOpenAIBaseUrl,
  isDashScopeCompatibleBaseUrl,
  usesRawOpenAICompatibleStream,
} from "../ai/openAICompatibleProviders";

describe("providers helpers", () => {
  it("detects DashScope-compatible endpoints", () => {
    expect(
      isDashScopeCompatibleBaseUrl(
        "https://dashscope.aliyuncs.com/compatible-mode/v1"
      )
    ).toBe(true);
    expect(
      isDashScopeCompatibleBaseUrl(
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
      )
    ).toBe(true);
    expect(isDashScopeCompatibleBaseUrl("https://api.openai.com/v1")).toBe(
      false
    );
  });

  it("uses raw OpenAI-compatible streaming only for providers that need it", () => {
    expect(
      usesRawOpenAICompatibleStream({
        type: "qwen",
        enabled: true,
        apiKey: "test",
        baseUrl: "",
        enabledModels: ["qwen3-max"],
        updatedAt: Date.now(),
      })
    ).toBe(true);

    expect(
      usesRawOpenAICompatibleStream({
        type: "openai",
        enabled: true,
        apiKey: "test",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        enabledModels: ["qwen3-max"],
        updatedAt: Date.now(),
      })
    ).toBe(true);

    expect(
      usesRawOpenAICompatibleStream({
        type: "openai",
        enabled: true,
        apiKey: "test",
        baseUrl: "https://api.openai.com/v1",
        enabledModels: ["gpt-4.1"],
        updatedAt: Date.now(),
      })
    ).toBe(false);

    expect(
      usesRawOpenAICompatibleStream({
        type: "google",
        enabled: true,
        apiKey: "test",
        baseUrl: "",
        enabledModels: ["gemini-2.5-flash"],
        updatedAt: Date.now(),
      })
    ).toBe(false);
  });

  it("returns configured or default OpenAI-compatible base url", () => {
    expect(
      getOpenAICompatibleBaseUrl({
        type: "qwen",
        enabled: true,
        apiKey: "test",
        baseUrl: "",
        enabledModels: ["qwen3.5-plus"],
        updatedAt: Date.now(),
      })
    ).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1");

    expect(
      getOpenAICompatibleBaseUrl({
        type: "openai",
        enabled: true,
        apiKey: "test",
        baseUrl: "https://example.com/v1",
        enabledModels: ["gpt-4.1"],
        updatedAt: Date.now(),
      })
    ).toBe("https://example.com/v1");
  });

  it("normalizes Ollama base urls for model and chat endpoints", () => {
    expect(getOllamaBaseUrl("http://localhost:11434/v1")).toBe(
      "http://localhost:11434"
    );
    expect(getOllamaBaseUrl(undefined)).toBe("http://localhost:11434");

    expect(getOllamaOpenAIBaseUrl("http://localhost:11434")).toBe(
      "http://localhost:11434/v1"
    );
    expect(getOllamaOpenAIBaseUrl("http://localhost:11434/v1")).toBe(
      "http://localhost:11434/v1"
    );
  });
});
