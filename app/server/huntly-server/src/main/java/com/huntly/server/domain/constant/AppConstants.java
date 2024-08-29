package com.huntly.server.domain.constant;

import lombok.experimental.UtilityClass;

/**
 * @author lcomplete
 */
@UtilityClass
public class AppConstants {
    public static final String DEFAULT_LUCENE_DIR = "lucene";

    public static final String HTTP_FEED_CACHE_DIR = "feed_cache";

    public static final Long HTTP_FEED_CACHE_MAXSIZE = 50L * 1024L * 1024L; // 50 MB

    public static final Integer DEFAULT_COLD_DATA_KEEP_DAYS = 60;

    public static final String AUTH_TOKEN_COOKIE_NAME = "auth_token";

    public static final Integer DEFAULT_CONNECTOR_FETCH_CORE_POOL_SIZE = 3;
    public static final Integer DEFAULT_CONNECTOR_FETCH_MAX_POOL_SIZE = 30;

    public static final Integer GITHUB_DEFAULT_FETCH_PAGE_SIZE = 20;
}
