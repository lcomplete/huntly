declare module '*.css';

interface PageModel {
  title: string
  content: string,
  url: string,
  thumbUrl: string,
  description: string,
  author: string,
  siteName: string,
  language: string,
  category: string,
  isLiked: boolean,
  isFavorite: boolean,
  domain: string,
  faviconUrl: string,
}

interface ShortcutPayload {
  tabId: number,
  shortcutId: number,
  shortcutName: string,
  content: string,
  url: string
}

interface Message {
  type: "auto_save_clipper" | "save_clipper" | 'tab_complete' | 'auto_save_tweets' | 'read_tweet' | 'parse_doc' | 'save_clipper_success' | 'article_preview' | 'process_shortcut' | 'cancel_processing' | 'processing_start' | 'process_result',
  payload?: any
}

