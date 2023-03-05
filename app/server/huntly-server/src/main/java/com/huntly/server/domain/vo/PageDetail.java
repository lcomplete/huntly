package com.huntly.server.domain.vo;

import com.huntly.server.domain.entity.Connector;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.entity.Source;
import lombok.Getter;
import lombok.Setter;

/**
 * @author lcomplete
 */
@Getter
@Setter
public class PageDetail {
    private Page page;
    
    private Connector connector;
    
    private Source source;
}
