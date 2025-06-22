package com.huntly.server.controller;

import com.huntly.common.api.ApiResult;
import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.dto.PageOperateResult;
import com.huntly.interfaces.external.model.ArticleContent;
import com.huntly.interfaces.external.model.CapturePage;
import com.huntly.interfaces.external.query.PageListQuery;
import com.huntly.interfaces.external.query.PageQuery;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.entity.PageArticleContent;
import com.huntly.server.domain.enums.ArticleContentCategory;
import com.huntly.server.service.PageArticleContentService;
import com.huntly.server.domain.vo.PageDetail;
import com.huntly.server.service.CapturePageService;
import com.huntly.server.service.PageListService;
import com.huntly.server.service.PageService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;


import javax.validation.Valid;
import java.io.IOException;
import java.io.PrintWriter;
import javax.validation.constraints.NotNull;
import java.util.List;
import java.util.function.Consumer;

import lombok.Data;

/**
 * @author lcomplete
 */
@Validated
@RestController
@RequestMapping("/api/page")
public class PageController {

    private final CapturePageService capturePageService;

    private final PageListService pageListService;

    private final PageService pageService;
    private final PageArticleContentService pageArticleContentService;

    public PageController(CapturePageService capturePageService, PageListService pageListService, PageService pageService, PageArticleContentService pageArticleContentService) {
        this.capturePageService = capturePageService;
        this.pageListService = pageListService;
        this.pageService = pageService;
        this.pageArticleContentService = pageArticleContentService;
    }

    @PostMapping("save")
    public ApiResult<Long> savePage(@Valid @RequestBody CapturePage capturePage) {
        var page =  capturePageService.save(capturePage);
        return ApiResult.ok(page.getId());
    }

    @GetMapping("pageOperateResult")
    public PageOperateResult getPageOperateResult(PageQuery query){
        return pageService.getPageOperateResult(query);
    }

    @GetMapping("list")
    public List<PageItem> listPageItems(@Valid PageListQuery pageListQuery) {
        return pageListService.getPageItems(pageListQuery);
    }

    @PostMapping("saveToLibrary/{id}")
    public PageOperateResult saveToLibrary(@Valid @NotNull @PathVariable("id") Long id) {
        return pageService.saveToLibrary(id);
    }

    @PostMapping("removeFromLibrary/{id}")
    public PageOperateResult removeFromLibrary(@Valid @NotNull @PathVariable("id") Long id) {
        return pageService.removeFromLibrary(id);
    }

    @PostMapping("archive/{id}")
    public PageOperateResult archiveToLibrary(@Valid @NotNull @PathVariable("id") Long id) {
        return pageService.archiveToLibrary(id);
    }

    @PostMapping("star/{id}")
    public PageOperateResult starPage(@Valid @NotNull @PathVariable("id") Long id) {
        return pageService.starPage(id);
    }

    @PostMapping("unStar/{id}")
    public PageOperateResult unStarPage(@Valid @NotNull @PathVariable("id") Long id) {
        return pageService.unStarPage(id);
    }

    @PostMapping("readLater/{id}")
    public PageOperateResult readLaterPage(@Valid @NotNull @PathVariable("id") Long id) {
        return pageService.readLaterPage(id);
    }

    @PostMapping("unReadLater/{id}")
    public PageOperateResult unReadLaterPage(@Valid @NotNull @PathVariable("id") Long id) {
        return pageService.unReadLaterPage(id);
    }

    @PostMapping("markRead/{id}")
    public void markReadPage(@Valid @NotNull @PathVariable("id") Long id) {
        pageService.markReadPage(id);
    }

    @PostMapping("markReadByPageIds")
    public ApiResult<Integer> markReadByPageIds(@Valid @NotNull @RequestBody List<Long> ids) {
        Integer effectCount = pageService.markReadByPageIds(ids, true);
        return ApiResult.ok(effectCount);
    }

    @PostMapping("markReadByConnectorId/{connectorId}")
    public ApiResult<Integer> markReadByConnectorId(@Valid @NotNull @PathVariable("connectorId") Integer connectorId) {
        Integer effectCount = pageService.markReadByConnectorId(connectorId, true);
        return ApiResult.ok(effectCount);
    }

    @PostMapping("markReadByFolderId/{folderId}")
    public ApiResult<Integer> markReadByFolderId(@Valid @NotNull @PathVariable("folderId") Integer folderId) {
        Integer effectCount = pageService.markReadByFolderId(folderId, true);
        return ApiResult.ok(effectCount);
    }

    @PostMapping("markReadByConnectorType/{type}")
    public ApiResult<Integer> markReadByConnectorType(@Valid @NotNull @PathVariable("type") Integer connectorType) {
        Integer effectCount = pageService.markReadByConnectorType(connectorType, true);
        return ApiResult.ok(effectCount);
    }

    @PostMapping("unMarkRead/{id}")
    public void unMarkReadPage(@Valid @NotNull @PathVariable("id") Long id) {
        pageService.unMarkReadPage(id);
    }

    @PostMapping("recordReadPage/{id}")
    public void recordReadPage(@Valid @NotNull @PathVariable("id") Long id) {
        pageService.recordReadPage(id);
    }

    @DeleteMapping("/{id}")
    public void deletePage(@Valid @NotNull @PathVariable("id") Long id) {
        pageService.delete(id);
    }

    @GetMapping("/{id}")
    public PageDetail getPageDetailById(@Valid @NotNull @PathVariable("id") Long id) {
        return pageService.getPageDetail(id);
    }
    
    @PostMapping("/fullContent/{id}")
    public ArticleContent fetchFullContentById(@Valid @NotNull @PathVariable("id") Long id) {
        Page page= pageService.fetchFullContent(id);
        return new ArticleContent(page.getId(), page.getContent());
    }

    @PostMapping("/rawContent/{id}")
    public ArticleContent switchRawContentById(@Valid @NotNull @PathVariable("id") Long id) {
        Page page= pageService.switchRawContent(id);
        return new ArticleContent(page.getId(), page.getContent());
    }

        /**
     * Create and configure SSE emitter with error handling
     * 
     * @param processor the processor function that takes an emitter and processes the request
     * @return configured SSE emitter
     */
    private SseEmitter createSseEmitterAndProcess(Consumer<SseEmitter> processor) {
        SseEmitter emitter = new SseEmitter(300000L); // 5 minutes timeout
        
        // Set up error and timeout handlers
        emitter.onError(throwable -> {
            try {
                emitter.send(SseEmitter.event().name("error").data("Connection error: " + throwable.getMessage()));
            } catch (Exception e) {
                // Failed to send error message, complete with error
            }
            emitter.completeWithError(throwable);
        });
        
        emitter.onTimeout(() -> {
            try {
                emitter.send(SseEmitter.event().name("error").data("Request timeout"));
                emitter.complete();
            } catch (Exception e) {
                emitter.completeWithError(new RuntimeException("SSE timeout"));
            }
        });
        
        // Call service directly - it handles async processing internally
        try {
            processor.accept(emitter);
        } catch (Exception e) {
            try {
                emitter.send(SseEmitter.event().name("error").data("Processing failed: " + e.getMessage()));
                emitter.complete();
            } catch (Exception sendException) {
                emitter.completeWithError(sendException);
            }
        }
        
        return emitter;
    }

    /**
     * Process article content with a specific shortcut using SSE streaming
     * 
     * @param id the page ID
     * @param shortcutId the ID of the shortcut to use
     * @return SSE emitter for streaming response
     */
    @GetMapping(value = "/processWithShortcut/{id}", produces = "text/event-stream")
    public SseEmitter processWithShortcut(
            @Valid @NotNull @PathVariable("id") Long id,
            @Valid @NotNull @RequestParam("shortcutId") Integer shortcutId,
            @RequestParam(value = "mode", defaultValue = "standard") String mode) {
        boolean isFastMode = "fast".equalsIgnoreCase(mode);
        return createSseEmitterAndProcess(emitter -> pageService.processWithShortcutStream(id, shortcutId, isFastMode, emitter));
    }

    /**
     * Process raw content with a specific shortcut without saving to database using SSE streaming
     * 
     * @param request the request containing content and shortcut ID
     * @return SSE emitter for streaming response
     */
    @PostMapping(value = "/processContentWithShortcut", produces = "text/event-stream")
    public SseEmitter processContentWithShortcut(@RequestBody ProcessContentRequest request) {
        boolean isFastMode = "fast".equalsIgnoreCase(request.getMode());
        return createSseEmitterAndProcess(emitter -> pageService.processContentWithShortcutStream(
            request.getContent(), 
            request.getShortcutId(),
            request.getBaseUri(),
            false,
            request.getTitle(),
            isFastMode,
            emitter
        ));
    }
    

    
    /**
     * Request model for processing content with a shortcut
     */
    @Data
    public static class ProcessContentRequest {
        private String content;
        private Integer shortcutId;
        private String baseUri = "";
        private String mode = "standard";
        private String title = "";
    }
}
