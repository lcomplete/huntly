import { getThinkingModeOptions } from "../ai/thinkingMode";

describe("thinkingMode", () => {
  it("returns enable_thinking: true when thinking mode is enabled", () => {
    expect(getThinkingModeOptions(true)).toEqual({
      enable_thinking: true,
    });
  });

  it("returns enable_thinking: false when thinking mode is disabled", () => {
    expect(getThinkingModeOptions(false)).toEqual({
      enable_thinking: false,
    });
  });
});
