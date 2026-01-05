package com.huntly.interfaces.external.query;

import lombok.Data;

import java.time.Instant;

/**
 * 同步查询参数
 */
@Data
public class SyncQuery {

    /**
     * 只返回 updatedAt 大于此时间的页面，用于增量同步
     * 如果为空则返回所有已保存的页面
     */
    private Instant updatedAfter;

    /**
     * 用于分页的游标更新时间（按 updatedAt 倒序）
     */
    private Instant cursorUpdatedAt;

    /**
     * 用于分页的游标 ID（updatedAt 相同情况下用于稳定排序）
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
