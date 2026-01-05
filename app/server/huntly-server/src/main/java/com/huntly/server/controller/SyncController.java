package com.huntly.server.controller;

import com.huntly.interfaces.external.dto.SyncContentResponse;
import com.huntly.interfaces.external.dto.SyncListResponse;
import com.huntly.interfaces.external.query.SyncQuery;
import com.huntly.interfaces.external.query.SyncReadQuery;
import com.huntly.server.service.SyncService;
import com.huntly.server.service.SyncTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.List;

/**
 * 高性能同步 API
 *
 * 性能优化：
 * 1. 元数据和内容分离，先拉元数据列表，再按需拉内容
 * 2. 支持高效的游标分页，返回 hasMore 和 nextCursor
 * 3. 不在服务端进行 Markdown 转换，由客户端处理
 * 4. 使用缓存减少数据库查询
 */
@Validated
@RestController
@RequestMapping("/api/sync")
@RequiredArgsConstructor
public class SyncController {

    private final SyncService syncService;
    private final SyncTokenService syncTokenService;

    /**
     * Saved 分类同步列表
     */
    @GetMapping("/saved")
    public SyncListResponse getSavedList(@Valid SyncQuery query, HttpServletRequest request) {
        requireValidSyncToken(request);
        return syncService.getSavedList(query);
    }

    /**
     * X/Twitter 分类同步列表
     */
    @GetMapping("/x")
    public SyncListResponse getTwitterList(@Valid SyncQuery query, HttpServletRequest request) {
        requireValidSyncToken(request);
        return syncService.getTwitterList(query);
    }

    /**
     * Github 分类同步列表
     */
    @GetMapping("/github")
    public SyncListResponse getGithubList(@Valid SyncQuery query, HttpServletRequest request) {
        requireValidSyncToken(request);
        return syncService.getGithubList(query);
    }

    /**
     * Feeds 分类同步列表
     */
    @GetMapping("/feeds")
    public SyncListResponse getFeedsList(@Valid SyncQuery query, HttpServletRequest request) {
        requireValidSyncToken(request);
        return syncService.getFeedsList(query);
    }

    /**
     * Recently Read 分类同步列表
     */
    @GetMapping("/recently-read")
    public SyncListResponse getRecentlyReadList(@Valid SyncReadQuery query, HttpServletRequest request) {
        requireValidSyncToken(request);
        return syncService.getRecentlyReadList(query);
    }

    /**
     * Highlights 分类同步列表
     */
    @GetMapping("/highlights")
    public SyncListResponse getHighlightsList(@Valid SyncQuery query, HttpServletRequest request) {
        requireValidSyncToken(request);
        return syncService.getHighlightsList(query);
    }

    /**
     * 按需获取单个页面的内容
     */
    @GetMapping("/content/{id}")
    public ResponseEntity<SyncContentResponse> getContent(
            @PathVariable Long id,
            HttpServletRequest request) {
        requireValidSyncToken(request);
        return syncService.getContent(id)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Page not found"));
    }

    /**
     * 批量获取页面内容（最多50条）
     */
    @PostMapping("/content/batch")
    public List<SyncContentResponse> getContentBatch(
            @RequestBody List<Long> ids,
            HttpServletRequest request) {
        requireValidSyncToken(request);
        return syncService.getContentBatch(ids);
    }

    /**
     * 刷新服务端缓存
     */
    @PostMapping("/cache/refresh")
    public ResponseEntity<Void> refreshCache(HttpServletRequest request) {
        requireValidSyncToken(request);
        syncService.refreshCache();
        return ResponseEntity.noContent().build();
    }

    /**
     * Validates sync token; useful for desktop clients to test authorization.
     */
    @GetMapping("/verify")
    public ResponseEntity<Void> verify(HttpServletRequest request) {
        requireValidSyncToken(request);
        return ResponseEntity.noContent().build();
    }

    /**
     * Ensures a local server sync token exists for desktop clients.
     */
    @GetMapping("/token")
    public ResponseEntity<Void> ensureSyncToken(HttpServletRequest request) {
        requireLocalRequest(request);
        syncTokenService.getOrCreateToken();
        return ResponseEntity.noContent().build();
    }

    private void requireValidSyncToken(HttpServletRequest request) {
        String token = request.getHeader("X-Huntly-Sync-Token");
        if (token == null || token.isBlank()) {
            token = request.getParameter("sync_token");
        }
        if (!syncTokenService.isValid(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid sync token");
        }
    }

    private void requireLocalRequest(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (remoteAddr == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Local request required");
        }
        if (!("127.0.0.1".equals(remoteAddr)
                || "::1".equals(remoteAddr)
                || "0:0:0:0:0:0:0:1".equals(remoteAddr))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Local request required");
        }
    }
}

