package com.huntly.interfaces.external.query;

import lombok.Data;

import java.time.Instant;

/**
 * 高亮同步查询参数
 */
@Data
public class SyncHighlightQuery {

    /**
     * 只返回 createdAt 大于此时间的高亮，用于增量同步
     */
    private Instant createdAfter;

    /**
     * 用于分页的游标创建时间（按 createdAt 倒序）
     */
    private Instant cursorCreatedAt;

    /**
     * 用于分页的游标 ID（createdAt 相同情况下用于稳定排序）
     */
    private Long cursorId;

    /**
     * 返回的最大数量，默认 100，最大 200
     */
    private Integer limit;

    public Integer getLimit() {
        return limit != null && limit > 0 ? Math.min(limit, 200) : 100;
    }
}

