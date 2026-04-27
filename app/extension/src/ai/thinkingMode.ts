/**
 * Returns extra request body options for thinking mode.
 * Some OpenAI-compatible providers default to thinking enabled, so callers
 * need an explicit false to turn it off.
 */
export function getThinkingModeOptions(
  thinkingModeEnabled: boolean
): Record<string, unknown> {
  return {
    enable_thinking: thinkingModeEnabled,
  };
}