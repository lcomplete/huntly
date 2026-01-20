package com.huntly.server.controller;

import com.huntly.common.api.ApiResult;
import com.huntly.interfaces.external.dto.BatchFilterResult;
import com.huntly.interfaces.external.dto.BatchMoveRequest;
import com.huntly.interfaces.external.dto.BatchMoveResult;
import com.huntly.interfaces.external.query.BatchFilterQuery;
import com.huntly.server.service.BatchOrganizeService;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * Controller for batch organizing library pages.
 *
 * @author lcomplete
 */
@Validated
@RestController
@RequestMapping("/api/page/batch")
@RequiredArgsConstructor
public class BatchOrganizeController {

    private final BatchOrganizeService batchOrganizeService;

    /**
     * Filter pages with pagination for batch operations.
     */
    @PostMapping("/filter")
    public ApiResult<BatchFilterResult> filterPages(@RequestBody BatchFilterQuery query) {
        return ApiResult.ok(batchOrganizeService.filterPages(query));
    }

    /**
     * Batch move pages to a collection.
     */
    @PostMapping("/moveToCollection")
    public ApiResult<BatchMoveResult> batchMoveToCollection(@RequestBody BatchMoveRequest request) {
        return ApiResult.ok(batchOrganizeService.batchMoveToCollection(request));
    }
}

