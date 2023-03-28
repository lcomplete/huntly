package com.huntly.server.event;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * @author lcomplete
 */
@Component
public class EventPublisher {
    private final ApplicationEventPublisher applicationEventPublisher;

    public EventPublisher(ApplicationEventPublisher eventPublisher) {
        this.applicationEventPublisher = eventPublisher;
    }
    
    public void publishInboxChangedEvent(InboxChangedEvent inboxChangedEvent){
        applicationEventPublisher.publishEvent(inboxChangedEvent);
    }

    public void publishTweetPageCaptureEvent(TweetPageCaptureEvent tweetPageCaptureEvent) {
        applicationEventPublisher.publishEvent(tweetPageCaptureEvent);
    }
}
