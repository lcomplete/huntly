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
    
    CONNECTED_AT("connectedAt");

    //ID("id");

    private String sortField;

    PageListSort(String sortField) {
        this.sortField = sortField;
    }

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
