package com.huntly.interfaces.external.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

/**
 * @author lcomplete
 */
@Getter
@Setter
@AllArgsConstructor
public class ArticleContent {
    private Long pageId;
    
    private String content;
}
