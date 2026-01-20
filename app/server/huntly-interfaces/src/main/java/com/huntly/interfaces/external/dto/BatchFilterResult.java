package com.huntly.interfaces.external.dto;

import lombok.Data;

import java.util.List;

/**
 * Result of batch filter query with pagination.
 *
 * @author lcomplete
 */
@Data
public class BatchFilterResult {

    /**
     * Total count of items matching the filter.
     */
    private long totalCount;

    /**
     * Simplified page items for current page.
     */
    private List<BatchPageItem> items;

    /**
     * Current page number (0-based).
     */
    private int currentPage;

    /**
     * Total number of pages.
     */
    private int totalPages;

    public static BatchFilterResult of(long totalCount, List<BatchPageItem> items, int currentPage, int totalPages) {
        BatchFilterResult result = new BatchFilterResult();
        result.setTotalCount(totalCount);
        result.setItems(items);
        result.setCurrentPage(currentPage);
        result.setTotalPages(totalPages);
        return result;
    }
}

