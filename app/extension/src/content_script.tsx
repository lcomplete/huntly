import { log } from "./logger";
import { setupRssDetectionListener } from "./rss/rssContentDetector";

// 判断是否需要注入 tweet_interceptor
function shouldInjectTweetInterceptor(): boolean {
  const supportDomains = ["twitter.com", "x.com"];
  return supportDomains.indexOf(window.location.hostname) >= 0;
}

export function initContentScript(): void {
  log("content script loaded");

  if (shouldInjectTweetInterceptor()) {
    const script = document.createElement("script");
    script.setAttribute("type", "text/javascript");
    script.setAttribute("src", chrome.runtime.getURL("/tweet-interceptor.js"));
    document.documentElement.appendChild(script);
  }

  window.addEventListener("message", function (event: MessageEvent<Message>) {
    if (event.data && typeof event.data.type === 'string') {
      chrome.runtime.sendMessage(event.data);
    }
  });

  setupRssDetectionListener();
}
