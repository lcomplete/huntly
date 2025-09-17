package com.huntly.server.repository;

import com.huntly.server.domain.entity.PageHighlight;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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
}