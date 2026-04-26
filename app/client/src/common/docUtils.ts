import {TweetProperties} from "../interfaces/tweetProperties";

type PageTitleSource = {
  title?: string | null;
  description?: string | null;
  content?: string | null;
  contentType?: number | null;
  pageJsonProperties?: string | null;
};

const TWEET_CONTENT_TYPES = new Set([1, 3]);
const TWEET_TITLE_MAX_LENGTH = 80;

function normalizeTitlePart(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function truncateTitle(value: string, maxLength = TWEET_TITLE_MAX_LENGTH) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength - 3).trimEnd() + "...";
}

function extractTweetText(tweetProps?: TweetProperties | null) {
  if (!tweetProps?.fullText) {
    return "";
  }

  if (tweetProps.noteTweet) {
    return normalizeTitlePart(tweetProps.fullText);
  }

  const fullTextChars = Array.from(tweetProps.fullText);
  const start = tweetProps.displayTextRange?.[0] ?? 0;
  const end = tweetProps.displayTextRange?.[1] ?? fullTextChars.length;

  return normalizeTitlePart(fullTextChars.slice(start, end).join(""));
}

function resolveTweetTitle(pageJsonProperties?: string | null) {
  if (!pageJsonProperties) {
    return "";
  }

  try {
    const tweetProps = JSON.parse(pageJsonProperties) as TweetProperties;
    const mainTweet = tweetProps?.retweetedTweet || tweetProps;
    const tweetText = extractTweetText(mainTweet);
    const author = normalizeTitlePart(mainTweet?.userName)
      || (normalizeTitlePart(mainTweet?.userScreeName) ? `@${normalizeTitlePart(mainTweet?.userScreeName)}` : "");

    if (author && tweetText) {
      return truncateTitle(`${author}: ${tweetText}`);
    }

    return truncateTitle(tweetText || author);
  } catch (error) {
    return "";
  }
}

export function getPageDisplayTitle(page?: PageTitleSource | null) {
  const explicitTitle = normalizeTitlePart(page?.title);
  if (explicitTitle) {
    return explicitTitle;
  }

  if (TWEET_CONTENT_TYPES.has(page?.contentType ?? -1)) {
    const tweetTitle = resolveTweetTitle(page?.pageJsonProperties);
    if (tweetTitle) {
      return tweetTitle;
    }
  }

  return truncateTitle(
    normalizeTitlePart(page?.description) || normalizeTitlePart(page?.content)
  );
}

export function setDocTitle(title?: string | null){
  const normalizedTitle = normalizeTitlePart(title);
  document.title = normalizedTitle ? `${normalizedTitle} / Huntly` : "Huntly";
}