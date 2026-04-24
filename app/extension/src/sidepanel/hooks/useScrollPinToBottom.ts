import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import {
  isScrollPinnedToBottom,
  shouldShowScrollToBottomButton,
} from "../utils/scrollToBottom";

interface UseScrollPinToBottomOptions<T> {
  /** The message list. A new reference triggers the auto-scroll effect. */
  messages: T[];
  /** Pixels from the bottom considered "pinned". */
  thresholdPx: number;
}

interface UseScrollPinToBottomResult {
  scrollContainerRef: RefObject<HTMLDivElement>;
  messagesEndRef: RefObject<HTMLDivElement>;
  showScrollToBottom: boolean;
  handleScroll: () => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

/**
 * Keeps the message list scrolled to the bottom while the user hasn't
 * manually scrolled away. Tracks the pinned state in a ref (so re-renders
 * don't clobber it) and exposes a toggle button indicator when the user
 * has scrolled up far enough.
 */
export function useScrollPinToBottom<T>(
  options: UseScrollPinToBottomOptions<T>
): UseScrollPinToBottomResult {
  const { messages, thresholdPx } = options;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    pinnedRef.current = true;
    setShowScrollToBottom(false);
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior });
  }, []);

  const handleScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const distanceToBottom =
      scrollContainer.scrollHeight -
      scrollContainer.scrollTop -
      scrollContainer.clientHeight;
    const pinned = isScrollPinnedToBottom(distanceToBottom, thresholdPx);

    pinnedRef.current = pinned;
    setShowScrollToBottom(
      shouldShowScrollToBottomButton(messages.length, pinned)
    );
  }, [messages.length, thresholdPx]);

  useEffect(() => {
    if (messages.length === 0) {
      pinnedRef.current = true;
      setShowScrollToBottom(false);
      return;
    }

    if (!pinnedRef.current) {
      setShowScrollToBottom(
        shouldShowScrollToBottomButton(messages.length, false)
      );
      return;
    }

    const frame = window.requestAnimationFrame(() => scrollToBottom("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [messages, scrollToBottom]);

  return {
    scrollContainerRef,
    messagesEndRef,
    showScrollToBottom,
    handleScroll,
    scrollToBottom,
  };
}
