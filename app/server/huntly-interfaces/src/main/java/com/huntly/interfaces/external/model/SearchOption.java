package com.huntly.interfaces.external.model;

import lombok.Getter;
import lombok.Setter;

/**
 * @author lcomplete
 */
@Getter
@Setter
public class SearchOption {
    private Type type;
    
    private Library library;
    
    private Boolean alreadyRead;
    
    private Boolean onlySearchTitle;
    
    public enum Type {
        TWEET,
        GITHUB_STARRED_REPO,
        BROWSER_HISTORY,
        FEEDS
    }
    
    public enum Library{
        MY_LIST,
        STARRED,
        READ_LATER,
        ARCHIVE,
        HIGHLIGHTS,
        UNSORTED
    }
}
