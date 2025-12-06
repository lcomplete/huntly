/**
 * RSS Feed Service
 * Handles API calls for RSS feed operations
 */

import { getApiBaseUrl } from '../services';
import { getData, postData } from '../utils';

export interface PreviewFeedsInfo {
  title: string;
  description: string;
  siteLink: string;
  feedUrl: string;
  siteFaviconUrl: string;
  subscribed: boolean;
}

export interface SubscribeFeedResult {
  success: boolean;
  error?: string;
  connector?: {
    id: number;
    name: string;
    subscribeUrl: string;
  };
}

/**
 * Preview a feed URL to get its information
 */
export async function previewFeed(subscribeUrl: string): Promise<PreviewFeedsInfo | null> {
  try {
    const baseUri = await getApiBaseUrl();
    if (!baseUri) {
      throw new Error('Server URL not configured');
    }
    
    const response = await getData(baseUri, `setting/feeds/preview?subscribeUrl=${encodeURIComponent(subscribeUrl)}`);
    if (response) {
      return JSON.parse(response);
    }
    return null;
  } catch (error) {
    console.error('Error previewing feed:', error);
    throw error;
  }
}

/**
 * Subscribe to a feed URL
 */
export async function subscribeFeed(subscribeUrl: string): Promise<SubscribeFeedResult> {
  try {
    const baseUri = await getApiBaseUrl();
    if (!baseUri) {
      return { success: false, error: 'Server URL not configured' };
    }
    
    const response = await postData(baseUri, `setting/feeds/follow?subscribeUrl=${encodeURIComponent(subscribeUrl)}`, {});
    
    if (response) {
      const connector = JSON.parse(response);
      return {
        success: true,
        connector: {
          id: connector.id,
          name: connector.name,
          subscribeUrl: connector.subscribeUrl,
        },
      };
    }
    
    return { success: false, error: 'No response from server' };
  } catch (error) {
    console.error('Error subscribing to feed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to subscribe to feed',
    };
  }
}

