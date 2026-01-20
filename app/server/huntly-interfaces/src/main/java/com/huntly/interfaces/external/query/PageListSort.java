package com.huntly.interfaces.external.query;

/**
 * @author lcomplete
 */

public enum PageListSort {
    CREATED_AT("createdAt"),
    ARCHIVED_AT("archivedAt"),

    LAST_READ_AT("lastReadAt"),

    READ_LATER_AT("readLaterAt"),

    SAVED_AT("savedAt"),

    STARRED_AT("starredAt"),

    CONNECTED_AT("connectedAt"),

    VOTE_SCORE("voteScore"),

    COLLECTED_AT("collectedAt"),

    /**
     * For unsorted pages only: sorts by createdAt which always exists.
     */
    UNSORTED_SAVED_AT("createdAt");

    private final String sortField;

    PageListSort(String sortField) {
        this.sortField = sortField;
    }

    /**
     * Returns the sort field.
     */
    public String getSortField() {
        return sortField;
    }

    static PageListSort valueOfSort(String sort) {
        if (sort == null) {
            return null;
        }
        var sorts = PageListSort.class.getEnumConstants();
        for (var enumSort : sorts) {
            if (sort.equals(enumSort.getSortField())) {
                return enumSort;
            }
        }
        return null;
    }
}
