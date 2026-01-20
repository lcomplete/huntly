package com.huntly.server.connector.rss;

import com.rometools.rome.feed.synd.SyndFeed;
import lombok.Getter;
import lombok.Setter;

/**
 * Result of fetching a feed, containing the parsed feed and HTTP cache headers.
 */
@Getter
@Setter
public class FeedFetchResult {
    /**
     * The parsed feed, null if the response was 304 Not Modified.
     */
    private SyndFeed feed;

    /**
     * Whether the feed was not modified (HTTP 304).
     */
    private boolean notModified;

    /**
     * ETag header from the response.
     */
    private String etag;

    /**
     * Last-Modified header from the response.
     */
    private String lastModified;

    public static FeedFetchResult notModified() {
        FeedFetchResult result = new FeedFetchResult();
        result.setNotModified(true);
        return result;
    }

    public static FeedFetchResult of(SyndFeed feed, String etag, String lastModified) {
        FeedFetchResult result = new FeedFetchResult();
        result.setFeed(feed);
        result.setNotModified(false);
        result.setEtag(etag);
        result.setLastModified(lastModified);
        return result;
    }
}
