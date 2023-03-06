package com.huntly.server.controller;

import com.huntly.interfaces.external.dto.PageSearchResult;
import com.huntly.interfaces.external.query.SearchQuery;
import com.huntly.server.domain.entity.SearchHistory;
import com.huntly.server.service.LuceneService;
import com.huntly.server.service.SearchHistoryService;
import com.huntly.server.service.TweetTrackService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * @author lcomplete
 */
@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final LuceneService luceneService;

    private final SearchHistoryService searchHistoryService;

    public SearchController(LuceneService luceneService, SearchHistoryService searchHistoryService) {
        this.luceneService = luceneService;
        this.searchHistoryService = searchHistoryService;
    }

    @PostMapping
    public PageSearchResult searchPages(@RequestBody SearchQuery searchQuery) {
        searchHistoryService.save(searchQuery.getQ(), searchQuery.getQueryOptions());
        return luceneService.searchPages(searchQuery);
    }

    @GetMapping("/recent")
    public List<SearchHistory> getRecentSearches() {
        return searchHistoryService.getRecentSearches(5);
    }

}
