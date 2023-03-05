export interface Size {
  width: number;
  height: number;
}

export interface Media {
  mediaUrl: string;
  smallMediaUrl: string;
  type: string;
  rawSize: Size;
  smallSize: Size;
  videoInfo?: VideInfo;
  indices: number[];
}

export interface Hashtag {
  text: string;
  indices: number[];
}

export interface TweetProperties {
  url: string;
  fullText: string;
  displayTextRange: number[];
  tweetIdStr: string;
  userIdStr: string;
  userName: string;
  userScreeName: string;
  userProfileImageUrl: string;
  quoteCount: number;
  replyCount: number;
  retweetCount: number;
  favoriteCount: number;
  viewCount: number;
  medias: Media[];
  createdAt: string;
  quotedTweet?: TweetProperties;
  card?: Card;
  hashtags: Hashtag[];
  userMentions: UserMention[];
  urls: UrlEntity[];
  retweetedTweet?: TweetProperties;
}

export interface Card{
  type?: string;
  title: string;
  description: string;
  imageUrl: string;
  url: string;
  domain: string;
  thumbnailImageUrl: string;
}

export interface UserMention {
  screenName: string;
  name: string;
  idStr: string;
  indices: number[];
}

export interface UrlEntity {
  url: string;
  expandedUrl: string;
  displayUrl: string;
  indices: number[];
}

export interface VideInfo{
  aspectRatio: number[];
  durationMillis: number;
  variants: Variant[];
}

export interface Variant{
  bitrate: number;
  contentType: string;
  url: string;
}