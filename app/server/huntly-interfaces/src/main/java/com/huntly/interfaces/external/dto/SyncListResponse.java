package com.huntly.interfaces.external.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * 同步列表响应
 * 支持高效游标分页，只返回元数据
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncListResponse {

    /**
     * 同步项元数据列表
     */
    private List<SyncItemMeta> items;

    /**
     * 是否还有更多数据
     */
    private boolean hasMore;

    /**
     * 下一页游标 - 时间戳
     */
    private Instant nextCursorAt;

    /**
     * 下一页游标 - ID
     */
    private Long nextCursorId;

    /**
     * 本次返回的数量
     */
    private int count;

    /**
     * 同步时间戳
     */
    private Instant syncAt;
}

