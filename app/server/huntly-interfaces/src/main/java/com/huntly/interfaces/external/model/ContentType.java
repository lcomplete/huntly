package com.huntly.interfaces.external.model;

/**
 * page content type
 * @author louch
 */
public enum ContentType {
    BROWSER_HISTORY(0), 
    TWEET(1), 
    MARKDOWN(2),
    /*
     * is in quoted tweet
     */
    QUOTED_TWEET(3),
    /**
     * snippet of page
     */
    SNIPPET(4);

    private final int code;

    public int getCode() {
        return code;
    }

    ContentType(int code) {
        this.code = code;
    }
}
