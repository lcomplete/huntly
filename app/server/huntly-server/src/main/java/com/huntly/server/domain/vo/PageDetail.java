package com.huntly.server.domain.vo;

import com.huntly.interfaces.external.dto.ConnectorItem;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.entity.PageArticleContent;
import com.huntly.server.domain.entity.Source;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * @author lcomplete
 */
@Getter
@Setter
public class PageDetail {
    private Page page;
    
    private ConnectorItem connector;
    
    private Source source;
    
    private List<PageArticleContent> pageContents;
}
