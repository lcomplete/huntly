/**
 * RSS Content Detector - Used in content script to detect RSS feeds
 * This module is designed to run in the page context (content script)
 */

export interface RssDetectionResult {
  isRssFeed: boolean;
  contentType?: string;
  title?: string;
  description?: string;
}

/**
 * Get XML content from the current page
 * Handles different browser rendering methods for XML pages
 */
function getXmlContent(): string | null {
  // WebKit browsers (Chrome/Safari) create a special XML viewer element
  const xmlViewerElement = document.querySelector("#webkit-xml-viewer-source-xml");
  if (xmlViewerElement) {
    return xmlViewerElement.innerHTML;
  }

  // Some browsers put XML content in a <pre> tag
  if (document.body?.childNodes?.[0]) {
    const firstChild = document.body.childNodes[0] as HTMLElement;
    if (firstChild.tagName?.toLowerCase() === 'pre') {
      return firstChild.innerText;
    }
  }

  return null;
}

/**
 * Remove CDATA wrapper from text content
 */
function stripCData(text: string | null | undefined): string | undefined {
  return text?.replace(/<!\[CDATA\[(.*?)]]>/g, '$1').trim();
}

/**
 * Parse RSS 2.0 format
 */
function parseRss2(xmlDoc: Document): { title?: string; description?: string } | null {
  const channel = xmlDoc.querySelector('channel');
  if (channel) {
    return {
      title: stripCData(channel.querySelector('title')?.textContent),
      description: stripCData(channel.querySelector('description')?.textContent),
    };
  }
  return null;
}

/**
 * Parse Atom format
 */
function parseAtom(xmlDoc: Document): { title?: string; description?: string } | null {
  const feed = xmlDoc.querySelector('feed');
  if (feed) {
    return {
      title: stripCData(feed.querySelector('title')?.textContent),
      description: stripCData(feed.querySelector('subtitle')?.textContent),
    };
  }
  return null;
}

/**
 * Parse RDF/RSS 1.0 format
 */
function parseRdf(xmlDoc: Document): { title?: string; description?: string } | null {
  const rdfElement = xmlDoc.getElementsByTagName('rdf:RDF')[0];
  if (rdfElement) {
    return {
      title: stripCData(xmlDoc.querySelector('channel title')?.textContent),
      description: stripCData(xmlDoc.querySelector('channel description')?.textContent),
    };
  }
  return null;
}

/**
 * Detect if the current page is an RSS/Atom feed
 * Should be called from content script
 */
export function detectRssFeedInPage(): RssDetectionResult {
  const contentType = document.contentType;
  const isXmlContentType = contentType && (
    contentType.includes('xml') ||
    contentType.includes('rss') ||
    contentType.includes('atom')
  );

  if (!isXmlContentType) {
    return { isRssFeed: false, contentType };
  }

  const xmlContent = getXmlContent();
  if (!xmlContent) {
    return { isRssFeed: false, contentType };
  }

  // Parse the XML content
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

  // Check for parsing errors
  if (xmlDoc.querySelector('parsererror')) {
    return { isRssFeed: false, contentType };
  }

  // Try different feed formats
  const rss2 = parseRss2(xmlDoc);
  if (rss2) {
    return { isRssFeed: true, contentType, ...rss2 };
  }

  const atom = parseAtom(xmlDoc);
  if (atom) {
    return { isRssFeed: true, contentType, ...atom };
  }

  const rdf = parseRdf(xmlDoc);
  if (rdf) {
    return { isRssFeed: true, contentType, ...rdf };
  }

  return { isRssFeed: false, contentType };
}

/**
 * Setup message listener for RSS detection requests
 * Call this once in content script
 */
export function setupRssDetectionListener(): void {
  chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
    if (msg.type === "detect_rss_feed") {
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        sendResponse(detectRssFeedInPage());
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          sendResponse(detectRssFeedInPage());
        });
        return true; // Keep the message channel open for async response
      }
    }
    return false;
  });
}

