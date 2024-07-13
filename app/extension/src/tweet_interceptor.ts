import {RequestInterceptor} from "./request_interceptor";

// do not import other modules here, because this file will be injected into the page

//region settings
type CategoryUrlPattern = {
  url: string,
  category: string,
}

type InterceptorSetting = {
  urlPatterns: CategoryUrlPattern[],
  handler: (responseText: string, responseUrl: string, category: string) => void
}

type MatchedSetting = {
  category: string,
  setting: InterceptorSetting,
}

function urlPattern(url: string, category: string): CategoryUrlPattern {
  return {url, category};
}

let loginScreenName = '';

const siteInterceptorSettings: { [domain: string]: InterceptorSetting[] } = {
  'x.com': [{
    urlPatterns: [urlPattern('graphql/.+/Bookmarks(\\?|$)', 'bookmark'),
      urlPattern('graphql/.+/.+Timeline(\\?|$)', 'timeline'),
      urlPattern('graphql/.+/UserTweets(\\?|$)', 'userTweets'),
      urlPattern('graphql/.+/UserMedia(\\?|$)', 'userTweets'),
      urlPattern('graphql/.+/UserTweetsAndReplies(\\?|$)', 'userTweets'),
      urlPattern('graphql/.+/Likes(\\?|$)', 'like'),
      urlPattern('graphql/.+/TweetDetail(\\?|$)', 'tweetDetail'),
    ],
    handler: (responseText: string, responseUrl: string, category: string) => {
      if (!loginScreenName) {
        try {
          const profileLink = document.querySelector("a[data-testid='AppTabBar_Profile_Link']");
          if (profileLink) {
            const profileLinkHref = profileLink.getAttribute('href');
            if (profileLinkHref && profileLinkHref.split('/').length > 1) {
              loginScreenName = profileLinkHref.split('/')[1];
            }
          }
        } catch (e) {
          console.log("userInfo intercept failed, error: " + e);
        }
      }
      let browserScreenName = '';
      if (category === 'like' && document.location.pathname.split('/').length > 1) {
        browserScreenName = document.location.pathname.split('/')[1];
      }
      window.postMessage({
        type: 'auto_save_tweets',
        payload: {category, jsonData: responseText, loginScreenName, browserScreenName}
      });
      trackSeenTweets();
    }
  }]
}

function matchInterceptorSetting(responseUrl: string): MatchedSetting {
  let docDomain = document.domain;
  if(docDomain === "twitter.com"){
    docDomain = "x.com";
  }
  const settings = siteInterceptorSettings[docDomain];
  const currentUrl = responseUrl.toLowerCase();
  if (settings) {
    for (const setting of settings) {
      for (const urlPattern of setting.urlPatterns) {
        const regex = new RegExp(urlPattern.url, 'i');
        if (regex.test(currentUrl))
          return {category: urlPattern.category, setting}
      }
    }
  }
  return null;
}

let trackTimeout = null;

function trackSeenTweets() {
  clearTimeout(trackTimeout);
  trackTimeout = setTimeout(markReadTweetsInView, 1000);
}

const haveReadTweets = [];

function markReadTweetsInView() {
  const tweetWrappers = document.querySelectorAll("article[data-testid=tweet]");
  for (const tweetWrapper of tweetWrappers) {
    if (isElementInViewport(tweetWrapper)) {
      const elTime = tweetWrapper.querySelector('time');
      if (elTime && elTime.parentElement.tagName === 'A') {
        const tweetUrl = elTime.parentElement.attributes['href'].value;
        const fragment = tweetUrl.split('/');
        const tweetId = fragment[fragment.length - 1];
        if (haveReadTweets.indexOf(tweetId) >= 0) {
          continue;
        }
        haveReadTweets.push(tweetId);
        window.postMessage({
          type: "read_tweet",
          payload: {id: tweetId}
        });
      }
    }
  }
}

function isElementInViewport(el: Element) {
  let rect = el.getBoundingClientRect();
  const windowHeight = (window.innerHeight || document.documentElement.clientHeight);
  return (
    rect.top >= 0 && rect.top <= windowHeight && (rect.top + 100) <= windowHeight &&
    rect.left >= 0 &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

//endregion

function interceptTwitterSite() {
  const supportDomains = ['twitter.com', 'x.com'];
  const domain = document.domain;
  if (supportDomains.indexOf(domain) >= 0) {
    new RequestInterceptor().enable(handleResponse);
    addEventListener('scroll', markReadTweetsInView, false);
    addEventListener('resize', markReadTweetsInView, false);
  }
}

function handleResponse(responseText: string, responseUrl: string) {
  const matchedSetting = matchInterceptorSetting(responseUrl);
  if (!matchedSetting)
    return;

  matchedSetting.setting.handler(responseText, responseUrl, matchedSetting.category);
}

interceptTwitterSite();

