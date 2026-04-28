export function isScrollPinnedToBottom(
  distanceToBottom: number,
  thresholdPx: number
): boolean {
  return distanceToBottom <= thresholdPx;
}

export function shouldShowScrollToBottomButton(
  messageCount: number,
  pinnedToBottom: boolean
): boolean {
  return messageCount > 0 && !pinnedToBottom;
}