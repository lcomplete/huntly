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
  contentType?: number,
}

interface ShortcutPayload {
  tabId: number,
  shortcutId: number,
  shortcutName: string,
  content: string,
  url: string
}

interface Message {
  type: "auto_save_clipper" | "save_clipper" | 'tab_complete' | 'auto_save_tweets' | 'read_tweet' | 'parse_doc' | 'save_clipper_success' | 'shortcuts_preview' | 'shortcuts_process' | 'shortcuts_cancel' | 'shortcuts_processing_start' | 'shortcuts_process_result' | 'shortcuts_process_data' | 'shortcuts_process_error' | 'get_selection' | 'detect_rss_feed',
  payload?: any
}

