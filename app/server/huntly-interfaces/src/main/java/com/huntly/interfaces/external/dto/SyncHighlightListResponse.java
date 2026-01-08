package com.huntly.interfaces.external.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

/**
 * 高亮同步列表响应
 */
@Data
@Builder
public class SyncHighlightListResponse {
    
    /**
     * 高亮列表
     */
    private List<SyncHighlightItem> items;
    
    /**
     * 是否有更多数据
     */
    private Boolean hasMore;
    
    /**
     * 下一页游标时间
     */
    private Instant nextCursorAt;
    
    /**
     * 下一页游标 ID
     */
    private Long nextCursorId;
    
    /**
     * 本次返回的数量
     */
    private Integer count;
    
    /**
     * 同步时间
     */
    private Instant syncAt;
}

