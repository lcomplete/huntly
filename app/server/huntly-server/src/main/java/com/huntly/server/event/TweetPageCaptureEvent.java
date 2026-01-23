package com.huntly.server.event;

import com.huntly.server.connector.twitter.ParsedTweetPage;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

/**
 * @author lcomplete
 */
@Getter
@Setter
@AllArgsConstructor
public class TweetPageCaptureEvent {
    private ParsedTweetPage parsedTweetPage;

    private String loginScreenName;

    private String browserScreenName;

    /**
     * Minimum likes count for auto-save filtering.
     * If null or 0, no filtering is applied.
     */
    private Integer minLikes;
}
