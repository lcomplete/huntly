package com.huntly.server.service;

import com.huntly.server.domain.entity.SearchHistory;
import com.huntly.server.repository.SearchHistoryRepository;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * @author lcomplete
 */
@Service
public class SearchHistoryService {
    private final SearchHistoryRepository searchHistoryRepository;

    public SearchHistoryService(SearchHistoryRepository searchHistoryRepository) {
        this.searchHistoryRepository = searchHistoryRepository;
    }

    public SearchHistory save(String q, String options) {
        if (StringUtils.isNotBlank(q)) {
            SearchHistory searchHistory = new SearchHistory();
            searchHistory.setQuery(q.trim());
            searchHistory.setOptions(options);
            searchHistory.setSearchAt(Instant.now());
            return searchHistoryRepository.save(searchHistory);
        }
        return null;
    }

    public List<SearchHistory> getRecentSearches(int limit) {
        List<SearchHistory> latestSearches = searchHistoryRepository.findTop10ByOrderByIdDesc();
        List<SearchHistory> distinctSearches = latestSearches.stream()
                .collect(Collectors.collectingAndThen(Collectors.toCollection(() -> new TreeSet<>(Comparator.comparing(SearchHistory::getQuery))), ArrayList::new));
        return distinctSearches.stream().sorted(Comparator.comparing(SearchHistory::getId).reversed()).limit(limit).collect(Collectors.toList());
    }
}
