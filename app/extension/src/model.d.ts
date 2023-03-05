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

interface Message {
	type: "save_clipper" | 'tab_complete' | 'save_tweets' | 'read_tweet',
	payload?: object
}