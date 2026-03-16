/**
 * Returns extra request body options for thinking mode.
 * The caller decides whether to enable thinking; this function provides the options.
 */
export function getThinkingModeOptions(
  thinkingModeEnabled: boolean
): Record<string, unknown> {
  // Explicitly set enable_thinking to match the user's choice.
  // Some models (e.g., Qwen) may default to thinking mode enabled,
  // so we need to explicitly disable it when the user wants it off.
  return {
    enable_thinking: thinkingModeEnabled,
  };
}
