package com.huntly.server.service;

import com.huntly.jpa.spec.Specifications;
import com.huntly.server.domain.entity.TweetTrack;
import com.huntly.server.repository.TweetTrackRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.Period;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * @author lcomplete
 */
@Service
@Slf4j
public class TweetTrackService {
    private final TweetTrackRepository tweetTrackRepository;

    private final PageService pageService;

    public TweetTrackService(TweetTrackRepository tweetTrackRepository, PageService pageService) {
        this.tweetTrackRepository = tweetTrackRepository;
        this.pageService = pageService;
    }

    public TweetTrack trackRead(String tweetId) {
        TweetTrack tweetTrack = new TweetTrack();
        tweetTrack.setTweetId(tweetId);
        tweetTrack.setReadAt(Instant.now());
        var page = pageService.recordReadTweetPage(tweetId);
        tweetTrack.setSetReadAt(page != null);
        return tweetTrackRepository.save(tweetTrack);
    }


    public void trackNotSetReads() {
        var specs = Specifications.<TweetTrack>and()
                .eq("setReadAt", false)
                .gt("readAt", Instant.now().minus(Period.ofDays(1)))
                .build();
        var tweetTracks = tweetTrackRepository.findAll(specs, 100, Sort.sort(TweetTrack.class).by(TweetTrack::getId).ascending());
        log.info("trackNotSetReads: {}", tweetTracks.size());
        AtomicInteger successCount = new AtomicInteger();
        tweetTracks.forEach(tweetTrack -> {
            var page = pageService.recordReadTweetPage(tweetTrack.getTweetId());
            if (page != null) {
                tweetTrack.setSetReadAt(true);
                tweetTrackRepository.save(tweetTrack);
                successCount.getAndIncrement();
            }
        });
        log.info("trackNotSetReads success: {}", successCount.get());
    }
}
