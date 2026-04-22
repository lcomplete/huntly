export type TitleGenerationRetryState = {
  requestKey: string | null;
  attempts: number;
};

export function resetTitleGenerationRetryState(
  requestKey: string | null = null
): TitleGenerationRetryState {
  return {
    requestKey,
    attempts: 0,
  };
}

export function getNextTitleGenerationRetryState(
  current: TitleGenerationRetryState,
  requestKey: string
): TitleGenerationRetryState {
  if (current.requestKey !== requestKey) {
    return {
      requestKey,
      attempts: 1,
    };
  }

  return {
    requestKey,
    attempts: current.attempts + 1,
  };
}

export function hasTitleGenerationAttemptsRemaining(
  attempts: number,
  maxAttempts: number
): boolean {
  return attempts < maxAttempts;
}

export function shouldUseThinkingForTitleGeneration(
  attempts: number
): boolean {
  return attempts > 1;
}