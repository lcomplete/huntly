import { useEffect, useRef, useState } from "react";

import { getTabContext, type TabContext } from "../utils/tabContext";

interface UseTabContextWatcherOptions {
  /**
   * When true, the watcher stops refreshing. Used while the user has already
   * attached a page context — we don't want tab switches to overwrite it.
   */
  paused: boolean;
  /** Called on every successful refresh so callers can clear related errors. */
  onRefreshed?: (tabContext: TabContext | null) => void;
}

/**
 * Tracks the active Chrome tab's title/URL/favicon and keeps it in sync as
 * the user switches tabs, focuses windows, or navigates. Pauses tracking
 * while `paused` is true so an explicitly-attached page context isn't
 * overwritten by tab changes.
 */
export function useTabContextWatcher(
  options: UseTabContextWatcherOptions
): TabContext | null {
  const { paused, onRefreshed } = options;
  const [tabContext, setTabContext] = useState<TabContext | null>(null);

  const onRefreshedRef = useRef(onRefreshed);
  useEffect(() => {
    onRefreshedRef.current = onRefreshed;
  }, [onRefreshed]);

  useEffect(() => {
    if (paused) return;

    let cancelled = false;
    const refresh = async () => {
      const nextTabContext = await getTabContext();
      if (!cancelled) {
        setTabContext(nextTabContext);
        onRefreshedRef.current?.(nextTabContext);
      }
    };

    const handleActivated = () => void refresh();
    const handleUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (
        tab.active &&
        (changeInfo.title ||
          changeInfo.url ||
          changeInfo.status === "complete")
      ) {
        void refresh();
      }
    };
    const handleFocusChanged = (windowId: number) => {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) void refresh();
    };

    void refresh();
    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);
    chrome.windows.onFocusChanged.addListener(handleFocusChanged);

    return () => {
      cancelled = true;
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      chrome.windows.onFocusChanged.removeListener(handleFocusChanged);
    };
  }, [paused]);

  return tabContext;
}
