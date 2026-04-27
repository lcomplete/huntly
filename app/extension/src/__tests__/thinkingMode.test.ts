import { getThinkingModeOptions } from "../ai/thinkingMode";

describe("thinking mode helpers", () => {
  it("always sends an explicit enable_thinking flag", () => {
    expect(getThinkingModeOptions(true)).toEqual({ enable_thinking: true });
    expect(getThinkingModeOptions(false)).toEqual({ enable_thinking: false });
  });
});