package com.huntly.server.service;

import com.huntly.interfaces.external.dto.SyncContentResponse;
import com.huntly.interfaces.external.dto.SyncItemMeta;
import com.huntly.interfaces.external.dto.SyncListResponse;
import com.huntly.interfaces.external.query.SyncQuery;
import com.huntly.interfaces.external.query.SyncReadQuery;
import com.huntly.server.domain.entity.Connector;
import com.huntly.server.domain.entity.Folder;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.projection.PageMetaProjection;
import com.huntly.server.repository.ConnectorRepository;
import com.huntly.server.repository.FolderRepository;
import com.huntly.server.repository.PageHighlightRepository;
import com.huntly.server.repository.PageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * 高性能同步服务
 *
 * 优化策略：
 * 1. 元数据和内容分离查询，避免一次性加载大量 content 字段
 * 2. 使用内存缓存 Connector 和 Folder 数据
 * 3. 优化游标分页查询
 * 4. 返回 hasMore 和 nextCursor 支持高效分页
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SyncService {

    private final PageRepository pageRepository;
    private final PageHighlightRepository pageHighlightRepository;
    private final ConnectorRepository connectorRepository;
    private final FolderRepository folderRepository;

    // 缓存 Connector 和 Folder 数据
    private final Map<Integer, Connector> connectorCache = new ConcurrentHashMap<>();
    private final Map<Integer, Folder> folderCache = new ConcurrentHashMap<>();
    private final AtomicLong lastCacheRefreshTime = new AtomicLong(0);
    private static final long CACHE_TTL_MS = 60_000; // 1 分钟缓存

    @PostConstruct
    public void init() {
        refreshCacheInternal();
    }

    /**
     * 刷新缓存
     */
    public void refreshCache() {
        refreshCacheInternal();
    }

    private synchronized void refreshCacheInternal() {
        long now = System.currentTimeMillis();
        if (now - lastCacheRefreshTime.get() < CACHE_TTL_MS) {
            return;
        }

        try {
            connectorCache.clear();
            connectorRepository.findAll().forEach(c -> connectorCache.put(c.getId(), c));
            folderCache.clear();
            folderRepository.findAll().forEach(f -> folderCache.put(f.getId(), f));
            lastCacheRefreshTime.set(now);
        } catch (Exception e) {
            log.error("Failed to refresh sync cache", e);
        }
    }

    private void ensureCacheValid() {
        if (System.currentTimeMillis() - lastCacheRefreshTime.get() > CACHE_TTL_MS) {
            refreshCacheInternal();
        }
    }

    public Map<Integer, Connector> getConnectorMap() {
        ensureCacheValid();
        return Collections.unmodifiableMap(connectorCache);
    }

    public Map<Integer, Folder> getFolderMap() {
        ensureCacheValid();
        return Collections.unmodifiableMap(folderCache);
    }

    /**
     * 获取 Saved 分类同步列表（使用投影查询，不加载 content）
     */
    public SyncListResponse getSavedList(SyncQuery query) {
        int limit = query.getLimit();
        var projections = pageRepository.findSavedMeta(
                query.getUpdatedAfter(),
                query.getCursorUpdatedAt(),
                query.getCursorId(),
                PageRequest.of(0, limit + 1));
        return buildResponse(projections, limit, false);
    }

    /**
     * 获取 Twitter/X 分类同步列表（使用投影查询，不加载 content）
     */
    public SyncListResponse getTwitterList(SyncQuery query) {
        int limit = query.getLimit();
        var projections = pageRepository.findTwitterMeta(
                query.getUpdatedAfter(),
                query.getCursorUpdatedAt(),
                query.getCursorId(),
                PageRequest.of(0, limit + 1));
        return buildResponse(projections, limit, false);
    }

    /**
     * 获取 GitHub 分类同步列表（使用投影查询，不加载 content）
     */
    public SyncListResponse getGithubList(SyncQuery query) {
        int limit = query.getLimit();
        var projections = pageRepository.findGithubMeta(
                query.getUpdatedAfter(),
                query.getCursorUpdatedAt(),
                query.getCursorId(),
                PageRequest.of(0, limit + 1));
        return buildResponse(projections, limit, false);
    }

    /**
     * 获取 Feeds 分类同步列表（使用投影查询，不加载 content）
     */
    public SyncListResponse getFeedsList(SyncQuery query) {
        int limit = query.getLimit();
        var projections = pageRepository.findFeedsMeta(
                query.getUpdatedAfter(),
                query.getCursorUpdatedAt(),
                query.getCursorId(),
                PageRequest.of(0, limit + 1));
        return buildResponse(projections, limit, false);
    }

    /**
     * 获取 RecentlyRead 分类同步列表（使用投影查询，不加载 content）
     */
    public SyncListResponse getRecentlyReadList(SyncReadQuery query) {
        int limit = query.getLimit();
        var projections = pageRepository.findRecentlyReadMeta(
                query.getReadAfter(),
                query.getCursorReadAt(),
                query.getCursorId(),
                PageRequest.of(0, limit + 1));
        return buildResponse(projections, limit, true);
    }

    /**
     * 获取 Highlights 分类同步列表（使用投影查询，不加载 content）
     */
    public SyncListResponse getHighlightsList(SyncQuery query) {
        int limit = query.getLimit();
        var projections = pageRepository.findHighlightsMeta(
                query.getUpdatedAfter(),
                query.getCursorUpdatedAt(),
                query.getCursorId(),
                PageRequest.of(0, limit + 1));
        return buildResponse(projections, limit, false);
    }

    /**
     * 构建响应，处理分页
     */
    private SyncListResponse buildResponse(List<PageMetaProjection> projections, int limit, boolean useLastReadAt) {
        boolean hasMore = projections.size() > limit;
        if (hasMore) {
            projections = projections.subList(0, limit);
        }

        List<SyncItemMeta> items = projections.stream()
                .map(this::toItemMeta)
                .collect(Collectors.toList());

        Instant nextCursorAt = null;
        Long nextCursorId = null;
        if (!projections.isEmpty() && hasMore) {
            PageMetaProjection last = projections.get(projections.size() - 1);
            nextCursorAt = useLastReadAt ? last.getLastReadAt() : last.getUpdatedAt();
            nextCursorId = last.getId();
        }

        return SyncListResponse.builder()
                .items(items)
                .hasMore(hasMore)
                .nextCursorAt(nextCursorAt)
                .nextCursorId(nextCursorId)
                .count(items.size())
                .syncAt(Instant.now())
                .build();
    }

    /**
     * 按需获取单个页面的内容
     */
    public Optional<SyncContentResponse> getContent(Long pageId) {
        return pageRepository.findById(pageId)
                .map(this::toContentResponse);
    }

    /**
     * 批量获取页面内容
     */
    public List<SyncContentResponse> getContentBatch(List<Long> pageIds) {
        if (pageIds == null || pageIds.isEmpty()) {
            return Collections.emptyList();
        }
        List<Long> limitedIds = pageIds.size() > 50 ? pageIds.subList(0, 50) : pageIds;
        return pageRepository.findAllById(limitedIds).stream()
                .map(this::toContentResponse)
                .collect(Collectors.toList());
    }

    private SyncContentResponse toContentResponse(Page page) {
        List<SyncContentResponse.HighlightInfo> highlights = Collections.emptyList();
        if (page.getHighlightCount() != null && page.getHighlightCount() > 0) {
            highlights = pageHighlightRepository.findByPageIdOrderByCreatedAtDesc(page.getId())
                    .stream()
                    .map(h -> SyncContentResponse.HighlightInfo.builder()
                            .id(h.getId())
                            .text(h.getHighlightedText())
                            .createdAt(h.getCreatedAt())
                            .build())
                    .collect(Collectors.toList());
        }
        return SyncContentResponse.builder()
                .id(page.getId())
                .title(page.getTitle())
                .content(page.getContent())
                .updatedAt(page.getUpdatedAt())
                .highlights(highlights)
                .build();
    }

    /**
     * 从投影接口转换为 DTO
     */
    private SyncItemMeta toItemMeta(PageMetaProjection p) {
        ensureCacheValid();

        // 获取 connector 和 folder 名称
        String connectorName = null;
        String folderName = null;
        if (p.getConnectorId() != null) {
            Connector connector = connectorCache.get(p.getConnectorId());
            if (connector != null) {
                connectorName = connector.getName();
            }
        }
        if (p.getFolderId() != null) {
            Folder folder = folderCache.get(p.getFolderId());
            if (folder != null) {
                folderName = folder.getName();
            }
        }

        return SyncItemMeta.builder()
                .id(p.getId())
                .title(p.getTitle())
                .url(p.getUrl())
                .author(p.getAuthor())
                .authorScreenName(p.getAuthorScreenName())
                .description(p.getDescription())
                .connectorType(p.getConnectorType())
                .connectorId(p.getConnectorId())
                .connectorName(connectorName)
                .folderId(p.getFolderId())
                .folderName(folderName)
                .contentType(p.getContentType())
                .librarySaveStatus(p.getLibrarySaveStatus())
                .starred(p.getStarred())
                .readLater(p.getReadLater())
                .savedAt(p.getSavedAt())
                .updatedAt(p.getUpdatedAt())
                .createdAt(p.getCreatedAt())
                .lastReadAt(p.getLastReadAt())
                .archivedAt(p.getArchivedAt())
                .thumbUrl(p.getThumbUrl())
                .highlightCount(p.getHighlightCount())
                .pageJsonProperties(p.getPageJsonProperties())
                .build();
    }
}

