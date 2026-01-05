package com.huntly.interfaces.external.query;

import lombok.Data;

import java.time.Instant;

/**
 * 最近阅读同步查询参数
 */
@Data
public class SyncReadQuery {

    /**
     * 只返回 lastReadAt 大于此时间的页面，用于增量同步
     */
    private Instant readAfter;

    /**
     * 用于分页的游标阅读时间（按 lastReadAt 倒序）
     */
    private Instant cursorReadAt;

    /**
     * 用于分页的游标 ID（lastReadAt 相同情况下用于稳定排序）
     */
    private Long cursorId;

    /**
     * 是否包含 markdown 内容（默认 false）
     */
    private Boolean includeMarkdown;

    /**
     * 返回的最大数量，默认 100，最大 200
     */
    private Integer limit;

    public Integer getLimit() {
        return limit != null && limit > 0 ? Math.min(limit, 200) : 100;
    }

    public boolean isIncludeMarkdown() {
        return Boolean.TRUE.equals(includeMarkdown);
    }
}
