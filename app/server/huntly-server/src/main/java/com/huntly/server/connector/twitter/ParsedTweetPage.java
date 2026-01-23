package com.huntly.server.connector.twitter;

import com.huntly.interfaces.external.model.TweetProperties;
import com.huntly.server.domain.entity.Page;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

/**
 * Container for a parsed tweet page with its properties.
 * This allows passing the TweetProperties along with the Page
 * to avoid re-parsing the JSON later.
 * 
 * @author lcomplete
 */
@Getter
@Setter
@AllArgsConstructor
public class ParsedTweetPage {
    private Page page;
    private TweetProperties tweetProperties;
    
    /**
     * Get the favorite count from the tweet properties.
     * For retweets, returns the count from the retweeted tweet.
     * 
     * @return the favorite count, or 0 if not available
     */
    public int getFavoriteCount() {
        if (tweetProperties == null) {
            return 0;
        }
        // For retweets, get the count from the retweeted tweet
        TweetProperties effectiveProperties = tweetProperties.getRetweetedTweet() != null 
                ? tweetProperties.getRetweetedTweet() 
                : tweetProperties;
        return effectiveProperties.getFavoriteCount() != null 
                ? effectiveProperties.getFavoriteCount() 
                : 0;
    }
}

