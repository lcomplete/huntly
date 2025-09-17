package com.huntly.server.controller;

import com.huntly.common.api.ApiResult;
import com.huntly.interfaces.external.dto.CreateHighlightRequest;
import com.huntly.interfaces.external.dto.HighlightListItem;
import com.huntly.interfaces.external.dto.PageHighlightDto;
import com.huntly.interfaces.external.query.HighlightListQuery;
import com.huntly.server.domain.entity.PageHighlight;
import com.huntly.server.domain.mapper.PageHighlightMapper;
import com.huntly.server.service.PageHighlightService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

/**
 * @author lcomplete
 */
@Validated
@RestController
@RequestMapping("/api/page-highlight")
@RequiredArgsConstructor
public class PageHighlightController {

    private final PageHighlightService pageHighlightService;

    /**
     * 创建高亮
     */
    @PostMapping
    public ApiResult<PageHighlightDto> createHighlight(@Valid @RequestBody CreateHighlightRequest request) {
        PageHighlight highlight = pageHighlightService.createHighlight(
                request.getPageId(),
                request.getHighlightedText(),
                request.getStartOffset(),
                request.getEndOffset()
        );
        return ApiResult.ok(PageHighlightMapper.INSTANCE.toDto(highlight));
    }

    /**
     * 删除高亮
     */
    @DeleteMapping("/{highlightId}")
    public ApiResult<Boolean> deleteHighlight(@PathVariable Long highlightId) {
        pageHighlightService.deleteHighlight(highlightId);
        return ApiResult.ok(true);
    }

    /**
     * 获取页面的所有高亮
     */
    @GetMapping("/page/{pageId}")
    public ApiResult<List<PageHighlightDto>> getHighlightsByPageId(@PathVariable Long pageId) {
        List<PageHighlight> highlights = pageHighlightService.getHighlightsByPageId(pageId);
        return ApiResult.ok(PageHighlightMapper.INSTANCE.toDtoList(highlights));
    }

    /**
     * 删除页面所有高亮
     */
    @DeleteMapping("/page/{pageId}")
    public ApiResult<Boolean> deleteHighlightsByPageId(@PathVariable Long pageId) {
        pageHighlightService.deleteHighlightsByPageId(pageId);
        return ApiResult.ok(true);
    }

    /**
     * 根据页面ID列表批量获取高亮
     */
    @PostMapping("/batch")
    public ApiResult<Map<Long, List<PageHighlightDto>>> getHighlightsByPageIds(@RequestBody List<Long> pageIds) {
        Map<Long, List<PageHighlightDto>> result = pageHighlightService.getHighlightsByPageIds(pageIds);
        return ApiResult.ok(result);
    }

    /**
     * 分页查询高亮列表
     */
    @GetMapping("/list")
    public ApiResult<Page<HighlightListItem>> getHighlightList(@Valid HighlightListQuery query) {
        Page<HighlightListItem> result = pageHighlightService.getHighlightList(query);
        return ApiResult.ok(result);
    }
}