export interface StreamingPreviewState {
  displayContent: string;
  responseContent: string;
  reasoningContent: string;
  isThinking: boolean;
  hasReceivedResponseText: boolean;
}

export interface StreamingPreviewChunk {
  type: string;
  text?: string;
  textDelta?: string;
}

export interface StreamingPreviewOptions {
  includeReasoning?: boolean;
}

export function createStreamingPreviewState(): StreamingPreviewState {
  return {
    displayContent: "",
    responseContent: "",
    reasoningContent: "",
    isThinking: false,
    hasReceivedResponseText: false,
  };
}

export function applyStreamingPreviewChunk(
  state: StreamingPreviewState,
  chunk: StreamingPreviewChunk,
  options: StreamingPreviewOptions = {}
): StreamingPreviewState {
  const includeReasoning = options.includeReasoning ?? true;
  const textDelta = chunk.text || chunk.textDelta || "";
  if (!textDelta) {
    return state;
  }

  if (chunk.type === "text-delta") {
    const responseContent = state.responseContent + textDelta;
    return {
      displayContent: responseContent,
      responseContent,
      reasoningContent: state.reasoningContent,
      isThinking: false,
      hasReceivedResponseText: true,
    };
  }

  if (chunk.type === "reasoning" || chunk.type === "reasoning-delta") {
    if (!includeReasoning) {
      return state;
    }

    return {
      displayContent: state.hasReceivedResponseText
        ? state.displayContent
        : state.displayContent + textDelta,
      responseContent: state.responseContent,
      reasoningContent: state.reasoningContent + textDelta,
      isThinking: !state.hasReceivedResponseText,
      hasReceivedResponseText: state.hasReceivedResponseText,
    };
  }

  return state;
}

export function getStreamingPreviewResult(
  state: StreamingPreviewState
): string {
  return state.responseContent || state.displayContent;
}

export function hasStreamingPreviewStateChanged(
  previousState: StreamingPreviewState,
  nextState: StreamingPreviewState
): boolean {
  return (
    previousState.displayContent !== nextState.displayContent ||
    previousState.responseContent !== nextState.responseContent ||
    previousState.reasoningContent !== nextState.reasoningContent ||
    previousState.isThinking !== nextState.isThinking
  );
}
