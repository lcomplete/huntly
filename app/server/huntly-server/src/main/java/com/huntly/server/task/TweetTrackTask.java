package com.huntly.server.task;

import com.huntly.server.service.TweetTrackService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * @author lcomplete
 */
@Component
@Slf4j
public class TweetTrackTask {
    private final TweetTrackService tweetTrackService;

    public TweetTrackTask(TweetTrackService tweetTrackService) {
        this.tweetTrackService = tweetTrackService;
    }
    
    @Scheduled(initialDelay = 1000 * 5, fixedDelay = 1000 * 10)
    public void trackRead() {
        tweetTrackService.trackNotSetReads();
    }
    
}
