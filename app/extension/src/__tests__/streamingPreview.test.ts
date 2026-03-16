import {
  applyStreamingPreviewChunk,
  createStreamingPreviewState,
  getStreamingPreviewResult,
  hasStreamingPreviewStateChanged,
} from "../ai/streamingPreview";

describe("streamingPreview", () => {
  it("shows reasoning chunks before response text arrives", () => {
    const state = applyStreamingPreviewChunk(createStreamingPreviewState(), {
      type: "reasoning",
      textDelta: "Thinking",
    });

    expect(state.displayContent).toBe("Thinking");
    expect(state.reasoningContent).toBe("Thinking");
    expect(state.isThinking).toBe(true);
    expect(getStreamingPreviewResult(state)).toBe("Thinking");
  });

  it("replaces reasoning preview with actual response text once text starts", () => {
    const withReasoning = applyStreamingPreviewChunk(
      createStreamingPreviewState(),
      {
        type: "reasoning",
        textDelta: "Thinking",
      }
    );

    const withText = applyStreamingPreviewChunk(withReasoning, {
      type: "text-delta",
      textDelta: "Final",
    });

    expect(withText.displayContent).toBe("Final");
    expect(withText.responseContent).toBe("Final");
    expect(withText.reasoningContent).toBe("Thinking");
    expect(withText.isThinking).toBe(false);
    expect(getStreamingPreviewResult(withText)).toBe("Final");
  });

  it("keeps later reasoning in the reasoning panel without changing answer preview", () => {
    const withText = applyStreamingPreviewChunk(
      createStreamingPreviewState(),
      {
        type: "text-delta",
        textDelta: "Answer",
      }
    );

    const withReasoning = applyStreamingPreviewChunk(withText, {
      type: "reasoning",
      textDelta: "Hidden",
    });

    expect(withReasoning.displayContent).toBe("Answer");
    expect(withReasoning.responseContent).toBe("Answer");
    expect(withReasoning.reasoningContent).toBe("Hidden");
    expect(withReasoning.isThinking).toBe(false);
  });

  it("detects reasoning-only state updates", () => {
    const initialState = applyStreamingPreviewChunk(
      createStreamingPreviewState(),
      {
        type: "text-delta",
        textDelta: "Answer",
      }
    );

    const nextState = applyStreamingPreviewChunk(initialState, {
      type: "reasoning",
      textDelta: "More thinking",
    });

    expect(hasStreamingPreviewStateChanged(initialState, nextState)).toBe(true);
  });

  it("ignores reasoning chunks when reasoning preview is disabled", () => {
    const initialState = createStreamingPreviewState();
    const nextState = applyStreamingPreviewChunk(
      initialState,
      {
        type: "reasoning",
        textDelta: "Hidden thinking",
      },
      {
        includeReasoning: false,
      }
    );

    expect(nextState).toEqual(initialState);
    expect(hasStreamingPreviewStateChanged(initialState, nextState)).toBe(
      false
    );
  });
});
