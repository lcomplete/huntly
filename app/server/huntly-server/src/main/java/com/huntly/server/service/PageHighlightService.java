package com.huntly.server.service;

import com.huntly.interfaces.external.dto.HighlightListItem;
import com.huntly.interfaces.external.dto.PageHighlightDto;
import com.huntly.interfaces.external.query.HighlightListQuery;
import com.huntly.server.domain.entity.PageHighlight;
import com.huntly.server.domain.mapper.PageHighlightMapper;
import com.huntly.server.repository.PageHighlightRepository;
import com.huntly.server.repository.PageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * @author lcomplete
 */
@Slf4j
@Service
public class PageHighlightService extends BasePageService {

    private final PageHighlightRepository pageHighlightRepository;

    public PageHighlightService(PageHighlightRepository pageHighlightRepository,
                               PageRepository pageRepository,
                               LuceneService luceneService) {
        super(pageRepository, luceneService);
        this.pageHighlightRepository = pageHighlightRepository;
    }

    /**
     * 创建高亮
     */
    @Transactional
    public PageHighlight createHighlight(Long pageId, String highlightedText, Integer startOffset, Integer endOffset) {
        PageHighlight highlight = new PageHighlight();
        highlight.setPageId(pageId);
        highlight.setHighlightedText(highlightedText);
        highlight.setStartOffset(startOffset);
        highlight.setEndOffset(endOffset);
        highlight.setCreatedAt(Instant.now());
        highlight.setUpdatedAt(Instant.now());

        PageHighlight savedHighlight = pageHighlightRepository.save(highlight);

        // 更新页面高亮计数
        updatePageHighlightCount(pageId);

        return savedHighlight;
    }

    /**
     * 删除高亮
     */
    @Transactional
    public void deleteHighlight(Long highlightId) {
        PageHighlight highlight = pageHighlightRepository.findById(highlightId)
                .orElseThrow(() -> new RuntimeException("Highlight not found"));
        
        Long pageId = highlight.getPageId();
        pageHighlightRepository.deleteById(highlightId);

        // 更新页面高亮计数
        updatePageHighlightCount(pageId);
    }

    /**
     * 根据页面ID获取所有高亮
     */
    public List<PageHighlight> getHighlightsByPageId(Long pageId) {
        return pageHighlightRepository.findByPageIdOrderByCreatedAtDesc(pageId);
    }

    /**
     * 删除页面所有高亮
     */
    @Transactional
    public void deleteHighlightsByPageId(Long pageId) {
        pageHighlightRepository.deleteByPageId(pageId);
        updatePageHighlightCount(pageId);
    }

    /**
     * 更新页面高亮计数
     */
    private void updatePageHighlightCount(Long pageId) {
        Integer count = pageHighlightRepository.countByPageId(pageId);
        com.huntly.server.domain.entity.Page page = pageRepository.findById(pageId)
                .orElseThrow(() -> new RuntimeException("Page not found"));

        page.setHighlightCount(count);
        save(page); // 使用父类的save方法，会自动更新Lucene索引
    }

    /**
     * 获取所有有高亮的页面ID
     */
    public List<Long> getPagesWithHighlights() {
        return pageHighlightRepository.findDistinctPageIds();
    }

    /**
     * 根据页面ID列表批量获取高亮
     */
    public Map<Long, List<PageHighlightDto>> getHighlightsByPageIds(List<Long> pageIds) {
        if (pageIds == null || pageIds.isEmpty()) {
            return Collections.emptyMap();
        }
        
        List<PageHighlight> highlights = pageHighlightRepository.findByPageIdIn(pageIds);
        
        return highlights.stream()
                .collect(Collectors.groupingBy(
                    PageHighlight::getPageId,
                    Collectors.mapping(
                        PageHighlightMapper.INSTANCE::toDto,
                        Collectors.toList()
                    )
                ));
    }

    /**
     * 分页查询高亮列表 - 纯净卡片视图
     */
    public org.springframework.data.domain.Page<HighlightListItem> getHighlightList(HighlightListQuery query) {
        // 构建查询条件
        Specification<PageHighlight> spec = (root, criteriaQuery, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            // 时间范围筛选
            if (query.getStartDate() != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("createdAt"), query.getStartDate()));
            }
            if (query.getEndDate() != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("createdAt"), query.getEndDate()));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };

        // 构建排序 - 只支持按创建时间排序
        Sort.Direction direction = "asc".equalsIgnoreCase(query.getDirection()) ? 
                Sort.Direction.ASC : Sort.Direction.DESC;
        Sort sort = Sort.by(direction, "createdAt");
        
        Pageable pageable = PageRequest.of(query.getPage(), query.getSize(), sort);

        // 执行查询
        org.springframework.data.domain.Page<PageHighlight> highlightPage = pageHighlightRepository.findAll(spec, pageable);

        // 转换为DTO
        return highlightPage.map(this::convertToListItem);
    }

    private HighlightListItem convertToListItem(PageHighlight highlight) {
        HighlightListItem item = new HighlightListItem();
        item.setId(highlight.getId());
        item.setPageId(highlight.getPageId());
        item.setHighlightedText(highlight.getHighlightedText());
        item.setStartOffset(highlight.getStartOffset());
        item.setEndOffset(highlight.getEndOffset());
        item.setCreatedAt(highlight.getCreatedAt());

        // 只获取跳转必需的基本页面信息
        pageRepository.findById(highlight.getPageId()).ifPresent(page -> {
            item.setPageTitle(page.getTitle());
            item.setPageUrl(page.getUrl());
        });

        return item;
    }
}