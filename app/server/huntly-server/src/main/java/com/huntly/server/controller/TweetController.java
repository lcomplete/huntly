package com.huntly.server.controller;

import com.huntly.common.api.ApiResult;
import com.huntly.interfaces.external.model.InterceptTweets;
import com.huntly.interfaces.external.model.TweetId;
import com.huntly.server.connector.twitter.TweetParser;
import com.huntly.server.domain.entity.TweetTrack;
import com.huntly.server.service.CapturePageService;
import com.huntly.server.service.TweetTrackService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * @author lcomplete
 */
@Validated
@RestController
@RequestMapping("/tweet")
@Slf4j
public class TweetController {

    private final CapturePageService capturePageService;
    
    private final TweetParser tweetParser;
    
    private final TweetTrackService tweetTrackService;

    public TweetController(CapturePageService capturePageService, TweetParser tweetParser, TweetTrackService tweetTrackService) {
        this.capturePageService = capturePageService;
        this.tweetParser = tweetParser;
        this.tweetTrackService = tweetTrackService;
    }

    @PostMapping("/saveTweets")
    public ApiResult<Integer> saveTweets(@RequestBody InterceptTweets tweets) {
        var pages = tweetParser.tweetsToPages(tweets);
        AtomicInteger count = new AtomicInteger();
        pages.forEach(page -> {
            capturePageService.saveTweetPage(page, tweets.getLoginScreenName(), tweets.getBrowserScreenName());
            count.getAndIncrement();
        });
        return ApiResult.ok(count.get());
    }

    @PostMapping(value = "/trackRead")
    public TweetTrack trackRead(@RequestBody TweetId tweetId) {
        return tweetTrackService.trackRead(tweetId.getId());
    }
}
