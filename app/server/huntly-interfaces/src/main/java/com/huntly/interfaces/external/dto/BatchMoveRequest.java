package com.huntly.interfaces.external.dto;

import com.huntly.interfaces.external.query.BatchFilterQuery;
import lombok.Data;

import java.util.List;

/**
 * Request for batch moving pages to a collection.
 *
 * @author lcomplete
 */
@Data
public class BatchMoveRequest {

    /**
     * Whether to select all items matching the filter.
     * If true, filterQuery is used; if false, pageIds is used.
     */
    private boolean selectAll;

    /**
     * List of page IDs to move (used when selectAll is false).
     */
    private List<Long> pageIds;

    /**
     * Filter query to determine which pages to move (used when selectAll is true).
     */
    private BatchFilterQuery filterQuery;

    /**
     * Target collection ID. Null means move to Unsorted.
     */
    private Long targetCollectionId;

    /**
     * How to set the collectedAt timestamp.
     * Values: KEEP (keep original), UPDATE_NOW (set to current time),
     * or a date field name (SAVED_AT, ARCHIVED_AT, CREATED_AT, CONNECTED_AT, etc.)
     */
    private String collectedAtMode;
}

