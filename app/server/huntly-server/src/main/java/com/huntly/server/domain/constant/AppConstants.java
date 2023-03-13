package com.huntly.server.domain.constant;

import lombok.experimental.UtilityClass;

/**
 * @author lcomplete
 */
@UtilityClass
public class AppConstants {
    public static final String DEFAULT_LUCENE_DIR = "lucene";

    public static final Integer DEFAULT_FETCH_INTERVAL_SECONDS = 600;

    public static final Integer DEFAULT_COLD_DATA_KEEP_DAYS = 60;

    public static final String AUTH_TOKEN_COOKIE_NAME = "auth_token";

    public static final Integer DEFAULT_CONNECTOR_FETCH_CORE_POOL_SIZE = 3;

    public static final Integer DEFAULT_CONNECTOR_FETCH_MAX_POOL_SIZE = 30;
    public static final Integer GITHUB_DEFAULT_FETCH_PAGE_SIZE = 20;
}
