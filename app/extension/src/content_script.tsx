import { log } from "./logger";

log("content script loaded");

// 判断是否需要注入 tweet_interceptor
function shouldInjectTweetInterceptor(): boolean {
  const supportDomains = ["twitter.com", "x.com"];
  return supportDomains.indexOf(window.location.hostname) >= 0;
}

// 只在需要的网站上注入代码
if (shouldInjectTweetInterceptor()) {
  // 在页面上插入代码，这样插入的代码才能访问页面中的 window 等全局变量
  const script = document.createElement("script");
  script.setAttribute("type", "text/javascript");
  script.setAttribute("src", chrome.runtime.getURL("/js/tweet_interceptor.js"));
  document.documentElement.appendChild(script);
}

window.addEventListener("message", function (event: MessageEvent<Message>) {
  chrome.runtime.sendMessage(event.data);
});
