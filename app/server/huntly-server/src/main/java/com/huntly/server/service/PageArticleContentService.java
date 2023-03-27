package com.huntly.server.service;

import com.huntly.server.domain.entity.PageArticleContent;
import com.huntly.server.domain.enums.ArticleContentCategory;
import com.huntly.server.repository.PageArticleContentRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * @author lcomplete
 */
@Service
public class PageArticleContentService {
    private final PageArticleContentRepository pageArticleContentRepository;

    public PageArticleContentService(PageArticleContentRepository pageArticleContentRepository) {
        this.pageArticleContentRepository = pageArticleContentRepository;
    }

    public PageArticleContent saveContent(Long pageId, String content, ArticleContentCategory contentCategory) {
        PageArticleContent pageContent = findContent(pageId, contentCategory);
        if (pageContent == null) {
            pageContent = new PageArticleContent();
        }
        pageContent.setPageId(pageId);
        pageContent.setContent(content);
        pageContent.setArticleContentCategory(contentCategory.getCode());
        pageContent.setUpdatedAt(Instant.now());
        return pageArticleContentRepository.save(pageContent);
    }

    public PageArticleContent findContent(Long pageId, ArticleContentCategory contentCategory) {
        return pageArticleContentRepository.findByPageIdAndArticleContentCategory(pageId, contentCategory.getCode()).orElse(null);
    }

    public void deleteContent(Long pageId, ArticleContentCategory contentCategory) {
        pageArticleContentRepository.deleteByPageIdAndArticleContentCategory(pageId, contentCategory.getCode());
    }

    public void deleteById(Long pageId) {
        pageArticleContentRepository.deleteById(pageId);
    }

    public List<PageArticleContent> findContents(Long pageId) {
        return pageArticleContentRepository.findAllByPageId(pageId);
    }

    public void deleteByPageId(Long pageId) {
        pageArticleContentRepository.deleteByPageId(pageId);
    }
}
