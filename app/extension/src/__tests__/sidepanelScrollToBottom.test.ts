import {
  isScrollPinnedToBottom,
  shouldShowScrollToBottomButton,
} from "../sidepanel/utils/scrollToBottom";

describe("sidepanel scroll-to-bottom helpers", () => {
  it("treats positions within the threshold as pinned to the bottom", () => {
    expect(isScrollPinnedToBottom(12, 96)).toBe(true);
    expect(isScrollPinnedToBottom(95, 96)).toBe(true);
    expect(isScrollPinnedToBottom(96, 96)).toBe(false);
  });

  it("shows the down-arrow button only when there are messages and the view is not pinned", () => {
    expect(shouldShowScrollToBottomButton(0, false)).toBe(false);
    expect(shouldShowScrollToBottomButton(3, true)).toBe(false);
    expect(shouldShowScrollToBottomButton(3, false)).toBe(true);
  });
});