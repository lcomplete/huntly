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
     * For unsorted pages only: sorts by collectedAt, savedAt, archivedAt in order.
     * Uses multiple sort fields for proper ordering.
     */
    UNSORTED_SAVED_AT("collectedAt", "savedAt", "archivedAt");

    private final String[] sortFields;

    PageListSort(String... sortFields) {
        this.sortFields = sortFields;
    }

    /**
     * Returns the primary sort field.
     */
    public String getSortField() {
        return sortFields[0];
    }

    /**
     * Returns all sort fields for multi-field sorting.
     */
    public String[] getSortFields() {
        return sortFields;
    }

    /**
     * Returns true if this sort uses multiple fields.
     */
    public boolean isMultiFieldSort() {
        return sortFields.length > 1;
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
