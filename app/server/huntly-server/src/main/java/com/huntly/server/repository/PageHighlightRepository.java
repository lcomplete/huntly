package com.huntly.server.repository;

import com.huntly.server.domain.entity.PageHighlight;
import com.huntly.server.domain.projection.HighlightMetaProjection;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

/**
 * @author lcomplete
 */
@Repository
public interface PageHighlightRepository extends BaseRepository<PageHighlight, Long> {

    List<PageHighlight> findByPageIdOrderByCreatedAtDesc(Long pageId);

    List<PageHighlight> findByPageIdIn(List<Long> pageIds);

    @Query("SELECT COUNT(h) FROM PageHighlight h WHERE h.pageId = :pageId")
    Integer countByPageId(@Param("pageId") Long pageId);

    @Modifying
    @Query("DELETE FROM PageHighlight h WHERE h.pageId = :pageId")
    void deleteByPageId(@Param("pageId") Long pageId);

    @Query("SELECT DISTINCT h.pageId FROM PageHighlight h")
    List<Long> findDistinctPageIds();

    /**
     * 高亮同步查询 - 按创建时间倒序，关联页面信息
     */
    @Query("SELECT h.id AS id, h.pageId AS pageId, h.highlightedText AS highlightedText, " +
           "h.createdAt AS createdAt, h.updatedAt AS updatedAt, " +
           "p.title AS pageTitle, p.url AS pageUrl, p.author AS author, " +
           "p.contentType AS contentType, p.connectorType AS connectorType, " +
           "p.connectorId AS connectorId, p.folderId AS folderId, p.updatedAt AS pageUpdatedAt " +
           "FROM PageHighlight h JOIN Page p ON h.pageId = p.id " +
           "WHERE (:createdAfter IS NULL OR h.createdAt > :createdAfter) " +
           "AND (:cursorAt IS NULL OR h.createdAt < :cursorAt OR (h.createdAt = :cursorAt AND h.id < :cursorId)) " +
           "ORDER BY h.createdAt DESC, h.id DESC")
    List<HighlightMetaProjection> findHighlightsMeta(
            @Param("createdAfter") Instant createdAfter,
            @Param("cursorAt") Instant cursorAt,
            @Param("cursorId") Long cursorId,
            Pageable pageable);
}