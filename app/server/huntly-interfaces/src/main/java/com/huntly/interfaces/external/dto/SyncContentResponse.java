package com.huntly.interfaces.external.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * 同步内容响应
 * 用于按需获取单条或批量内容
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncContentResponse {

    private Long id;

    private String title;

    /**
     * HTML 内容
     */
    private String content;

    /**
     * Markdown 内容（从 HTML 转换而来，限制大小以防止内存问题）
     */
    private String markdown;

    /**
     * 最后更新时间
     */
    private Instant updatedAt;

    /**
     * 高亮列表（如有）
     */
    private List<HighlightInfo> highlights;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HighlightInfo {
        private Long id;
        private String text;
        private Instant createdAt;
    }
}

