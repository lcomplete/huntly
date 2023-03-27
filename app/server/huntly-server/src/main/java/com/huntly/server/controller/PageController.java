package com.huntly.server.controller;

import com.huntly.common.api.ApiResult;
import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.dto.PageOperateResult;
import com.huntly.interfaces.external.model.ArticleContent;
import com.huntly.interfaces.external.model.CapturePage;
import com.huntly.interfaces.external.query.PageListQuery;
import com.huntly.interfaces.external.query.PageQuery;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.vo.PageDetail;
import com.huntly.server.service.CapturePageService;
import com.huntly.server.service.PageListService;
import com.huntly.server.service.PageService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import java.util.List;

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

    public PageController(CapturePageService capturePageService, PageListService pageListService, PageService pageService) {
        this.capturePageService = capturePageService;
        this.pageListService = pageListService;
        this.pageService = pageService;
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
    
}
