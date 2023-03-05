package com.huntly.server.util;

import lombok.experimental.UtilityClass;
import org.apache.commons.lang3.ObjectUtils;

@UtilityClass
public class PageSizeUtils {

    public static final int DEFAULT_PAGE_SIZE = 30;

    public static final int MAX_PAGE_SIZE = 500;

    public static int getPageSize(int requestPageSize, int defaultPageSize, int maxPageSize) {
        if (requestPageSize <= 0) {
            requestPageSize = defaultPageSize;
        }
        return Math.min(requestPageSize, maxPageSize);
    }

    public static int getPageSize(int requestPageSize, int defaultPageSize) {
        return getPageSize(requestPageSize, defaultPageSize, MAX_PAGE_SIZE);
    }

    public static int getPageSize(int requestPageSize) {
        return getPageSize(requestPageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    }
}
