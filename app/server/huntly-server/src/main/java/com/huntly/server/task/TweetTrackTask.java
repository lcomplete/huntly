package com.huntly.server.task;

import com.huntly.server.service.TweetTrackService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

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

    @Scheduled(initialDelay = 1000 * 5, fixedDelay = 1000 * 60 * 5)
    public void trackRead() {
        tweetTrackService.trackNotSetReads();
    }

    @Scheduled(initialDelay = 1000 * 60, fixedDelay = 1000 * 60 * 60)
    public void cleanHistoryTrack() {
        Instant createdBefore = Instant.now().minus(1, ChronoUnit.DAYS);
        Integer effectCount = tweetTrackService.cleanHistoryTrack(createdBefore);
        log.info("clean history track, effect count: {}", effectCount);
    }
}
