package com.huntly.server.repository;

import com.huntly.server.domain.entity.PageArticleContent;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * @author lcomplete
 */
@Repository
public interface PageArticleContentRepository extends BaseRepository<PageArticleContent,Long>  {
    Optional<PageArticleContent> findByPageIdAndArticleContentCategory(Long pageId, Integer articleContentCategory);
    
    @Transactional
    void deleteByPageIdAndArticleContentCategory(Long pageId, Integer articleContentCategory);

    List<PageArticleContent> findAllByPageId(Long pageId);
    
    @Transactional
    void deleteByPageId(Long pageId);
}
