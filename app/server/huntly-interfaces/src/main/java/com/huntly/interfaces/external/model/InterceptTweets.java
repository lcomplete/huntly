package com.huntly.interfaces.external.model;

import lombok.Getter;
import lombok.Setter;

/**
 * @author lcomplete
 */
@Getter
@Setter
public class InterceptTweets {

    private String category;

    private String jsonData;

    private String loginScreenName;

    private String browserScreenName;

    /**
     * Minimum likes count for auto-save filtering.
     * Only tweets with favoriteCount >= minLikes will be saved.
     * If null or 0, all tweets will be saved.
     */
    private Integer minLikes;
}
