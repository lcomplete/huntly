package com.huntly.server.connector;

import com.huntly.interfaces.external.model.CapturePage;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Result of fetching pages from a connector, including HTTP cache headers.
 */
@Getter
@Setter
public class FetchPagesResult {
    /**
     * The fetched pages, empty if the feed was not modified.
     */
    private List<CapturePage> pages;

    /**
     * Whether the feed was not modified (HTTP 304).
     */
    private boolean notModified;

    /**
     * ETag header from the response.
     */
    private String httpEtag;

    /**
     * Last-Modified header from the response.
     */
    private String httpLastModified;

    public static FetchPagesResult notModified() {
        FetchPagesResult result = new FetchPagesResult();
        result.setNotModified(true);
        return result;
    }

    public static FetchPagesResult of(List<CapturePage> pages, String httpEtag, String httpLastModified) {
        FetchPagesResult result = new FetchPagesResult();
        result.setPages(pages);
        result.setNotModified(false);
        result.setHttpEtag(httpEtag);
        result.setHttpLastModified(httpLastModified);
        return result;
    }
}
