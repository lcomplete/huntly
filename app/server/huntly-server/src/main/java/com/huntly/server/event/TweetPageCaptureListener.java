package com.huntly.server.event;

import com.huntly.server.service.CapturePageService;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * @author lcomplete
 */
@Component
public class TweetPageCaptureListener {
    private final CapturePageService capturePageService;

    public TweetPageCaptureListener(CapturePageService capturePageService) {
        this.capturePageService = capturePageService;
    }
    
    @EventListener
    @Async
    public void tweetPageCaptureEvent(TweetPageCaptureEvent event) {
        capturePageService.saveTweetPage(event.getPage(), event.getLoginScreenName(), event.getBrowserScreenName());
    }
}
