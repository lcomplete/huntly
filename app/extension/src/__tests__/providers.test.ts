import {
  getOpenAICompatibleBaseUrl,
  getOllamaBaseUrl,
  getOllamaOpenAIBaseUrl,
} from "../ai/openAICompatibleProviders";
import { getEffectiveApiFormat, PROVIDER_REGISTRY } from "../ai/types";

describe("providers helpers", () => {
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

  it("falls back to the provider native format when no override is given", () => {
    expect(getEffectiveApiFormat({ type: "qwen" })).toBe("openai");
    expect(getEffectiveApiFormat({ type: "anthropic" })).toBe("anthropic");
  });

  it("honours the user-selected api format for flexible providers", () => {
    expect(
      getEffectiveApiFormat({ type: "qwen", apiFormat: "anthropic" })
    ).toBe("anthropic");
    expect(
      getEffectiveApiFormat({ type: "zhipu", apiFormat: "anthropic" })
    ).toBe("anthropic");
  });

  it("ignores an api format override on providers that do not allow it", () => {
    // openai has a fixed native format; the override should be ignored.
    expect(
      getEffectiveApiFormat({ type: "openai", apiFormat: "anthropic" })
    ).toBe("openai");
  });

  it("includes DeepSeek V4 preset models without changing the existing default", () => {
    expect(PROVIDER_REGISTRY.deepseek.defaultModels.map((model) => model.id)).toEqual([
      "deepseek-chat",
      "deepseek-reasoner",
      "deepseek-v4-flash",
      "deepseek-v4-pro",
    ]);
  });
});
