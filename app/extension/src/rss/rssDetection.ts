/**
 * RSS Feed Detection - Popup Side
 * Communicates with content script to detect RSS feeds
 */

import { RssDetectionResult } from './rssContentDetector';

export interface RssFeedInfo {
  isRssFeed: boolean;
  feedUrl: string;
  title?: string;
  description?: string;
}

/**
 * Send message to content script and get response
 */
function sendMessageToTab(tabId: number, message: Message): Promise<RssDetectionResult | null> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        // Content script not loaded or other error
        resolve(null);
      } else {
        resolve(response as RssDetectionResult);
      }
    });
  });
}

/**
 * Detect if the current tab is an RSS/Atom feed
 * Sends message to content script which checks document.contentType and content
 */
export async function detectRssFeed(url: string): Promise<RssFeedInfo> {
  const result: RssFeedInfo = {
    isRssFeed: false,
    feedUrl: url,
  };

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab?.id) {
      return result;
    }

    const response = await sendMessageToTab(tab.id, { type: 'detect_rss_feed' });

    if (response?.isRssFeed) {
      result.isRssFeed = true;
      result.title = response.title;
      result.description = response.description;
    }
  } catch {
    // Content script might not be injected on some pages (chrome://, etc.)
  }

  return result;
}

