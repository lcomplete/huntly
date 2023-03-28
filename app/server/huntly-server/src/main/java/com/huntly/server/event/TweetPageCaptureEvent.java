package com.huntly.server.event;

import com.huntly.server.domain.entity.Page;
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
    private Page page;
    
    private String loginScreenName;
    
    private String browserScreenName;
}
