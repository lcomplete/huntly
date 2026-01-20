package com.huntly.interfaces.external.query;

import lombok.Data;

/**
 * Query parameters for batch filtering pages in library.
 *
 * @author lcomplete
 */
@Data
public class BatchFilterQuery {

    /**
     * Filter by library save status.
     * Values: ALL (both), SAVED (My List), ARCHIVED (Archive)
     */
    private String saveStatus;

    /**
     * Content type to filter.
     * Values: ALL, ARTICLE (includes BROWSER_HISTORY, MARKDOWN), TWEET (includes TWEET, QUOTED_TWEET), SNIPPET
     */
    private String contentType;

    /**
     * Filter by collection ID.
     * - Positive number: specific collection
     * - Null or not set: all collections
     */
    private Long collectionId;

    /**
     * Whether to filter for unsorted pages only (collectionId = null in database).
     */
    private Boolean filterUnsorted;

    /**
     * Filter for starred pages only.
     */
    private Boolean starred;

    /**
     * Filter for read later pages only.
     */
    private Boolean readLater;

    /**
     * Filter by author name (partial match, case-insensitive).
     */
    private String author;

    /**
     * Start date for createdAt filter (YYYY-MM-DD format).
     */
    private String startDate;

    /**
     * End date for createdAt filter (YYYY-MM-DD format).
     */
    private String endDate;

    /**
     * Page number (0-based).
     */
    private Integer page;

    /**
     * Page size (default 20).
     */
    private Integer size;
}

