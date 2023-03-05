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
}
