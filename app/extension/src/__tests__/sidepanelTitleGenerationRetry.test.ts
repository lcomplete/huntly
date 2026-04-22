import {
  getNextTitleGenerationRetryState,
  hasTitleGenerationAttemptsRemaining,
  resetTitleGenerationRetryState,
  shouldUseThinkingForTitleGeneration,
} from "../sidepanel/utils/titleGenerationRetry";

describe("sidepanel title generation retry helpers", () => {
  it("starts a new request at the first attempt", () => {
    const next = getNextTitleGenerationRetryState(
      resetTitleGenerationRetryState(),
      "session-1:message-1"
    );

    expect(next).toEqual({
      requestKey: "session-1:message-1",
      attempts: 1,
    });
  });

  it("increments attempts for the same request", () => {
    const first = getNextTitleGenerationRetryState(
      resetTitleGenerationRetryState(),
      "session-1:message-1"
    );
    const second = getNextTitleGenerationRetryState(
      first,
      "session-1:message-1"
    );

    expect(second).toEqual({
      requestKey: "session-1:message-1",
      attempts: 2,
    });
  });

  it("resets attempts when the latest message changes", () => {
    const current = getNextTitleGenerationRetryState(
      resetTitleGenerationRetryState(),
      "session-1:message-1"
    );
    const next = getNextTitleGenerationRetryState(
      current,
      "session-1:message-2"
    );

    expect(next).toEqual({
      requestKey: "session-1:message-2",
      attempts: 1,
    });
  });

  it("stops retrying once the attempt budget is exhausted", () => {
    expect(hasTitleGenerationAttemptsRemaining(1, 3)).toBe(true);
    expect(hasTitleGenerationAttemptsRemaining(2, 3)).toBe(true);
    expect(hasTitleGenerationAttemptsRemaining(3, 3)).toBe(false);
  });

  it("keeps thinking disabled on the first attempt only", () => {
    expect(shouldUseThinkingForTitleGeneration(1)).toBe(false);
    expect(shouldUseThinkingForTitleGeneration(2)).toBe(true);
    expect(shouldUseThinkingForTitleGeneration(3)).toBe(true);
  });
});