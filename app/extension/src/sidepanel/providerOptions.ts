import type { ProviderOptions } from "@ai-sdk/provider-utils";

const ANTHROPIC_THINKING_BUDGET_TOKENS = 4000;

export function buildBaseProviderOptions(_provider?: string): ProviderOptions {
  return {
    openai: { systemMessageMode: "system" },
  };
}

export function buildThinkingProviderOptions(
  provider?: string
): ProviderOptions {
  const options = buildBaseProviderOptions(provider);

  options.anthropic = {
    thinking: {
      type: "enabled",
      budgetTokens: ANTHROPIC_THINKING_BUDGET_TOKENS,
    },
  };
  options.deepseek = {
    thinking: { type: "enabled" },
  };
  options.google = {
    thinkingConfig: { thinkingLevel: "high", includeThoughts: true },
  };
  options.openai = {
    ...options.openai,
    reasoningEffort: "high",
    reasoningSummary: "auto",
    forceReasoning: true,
  };
  options.groq = {
    reasoningEffort: "high",
  };

  return options;
}
