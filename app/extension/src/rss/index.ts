// Popup-side: detect RSS via content script messaging
export { detectRssFeed } from './rssDetection';
export type { RssFeedInfo } from './rssDetection';

// Content script-side: actual RSS detection logic
export { detectRssFeedInPage, setupRssDetectionListener } from './rssContentDetector';
export type { RssDetectionResult } from './rssContentDetector';

// API services for subscribing to feeds
export { previewFeed, subscribeFeed } from './rssService';
export type { PreviewFeedsInfo, SubscribeFeedResult } from './rssService';

// UI component for RSS subscription
export { RssSubscription } from './RssSubscription';
export type { RssSubscriptionProps } from './RssSubscription';

