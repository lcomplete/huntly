package com.huntly.server.service;

import com.huntly.server.config.HuntlyProperties;
import com.huntly.server.domain.constant.DocFields;
import com.huntly.server.domain.entity.Collection;
import com.huntly.server.repository.CollectionRepository;
import com.huntly.server.repository.PageRepository;
import com.huntly.interfaces.external.model.SearchOption;
import com.huntly.interfaces.external.query.SearchQuery;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LuceneServiceSearchSyntaxTest {

    @Test
    void splitSearchTokens_keepsQuotedAdvancedSearchValueTogether() {
        List<String> tokens = LuceneService.splitSearchTokens("machine collection:\"Daily Reads\" author:\"Jane Doe\"");

        assertThat(tokens).containsExactly("machine", "collection:Daily Reads", "author:Jane Doe");
    }

    @Test
    void splitSearchTokens_unescapesQuotedCharactersInsideQuotedValue() {
        List<String> tokens = LuceneService.splitSearchTokens("collection:\"Daily \\\"Reads\\\"\"");

        assertThat(tokens).containsExactly("collection:Daily \"Reads\"");
    }

    @Test
    void extractAdvancedSearchKeyword_usesFirstSeparatorOnly() {
        String keyword = LuceneService.extractAdvancedSearchKeyword("url:https://example.com/a:b", ":");

        assertThat(keyword).isEqualTo("https://example.com/a:b");
    }

    @Test
    void extractCompleteSearch_usesQuotedCollectionNameForCollectionFilter() {
        CollectionRepository collectionRepository = mock(CollectionRepository.class);
        Collection collection = new Collection();
        collection.setId(42L);
        collection.setName("Daily Reads");
        when(collectionRepository.findByNameContainingIgnoreCase("Daily Reads")).thenReturn(List.of(collection));

        LuceneService luceneService = new LuceneService(
                mock(PageRepository.class),
                mock(PageListService.class),
                new HuntlyProperties(),
                collectionRepository
        );

        LuceneService.CompleteSearch completeSearch = luceneService.extractCompleteSearch("machine collection:\"Daily Reads\"");

        assertThat(completeSearch.getKeyword()).isEqualTo("machine");
        assertThat(completeSearch.getCollectionIds()).containsExactly(42L);
    }

    @Test
    void resolveSearchOption_prefersStructuredSearchQueryFields() {
        LuceneService luceneService = new LuceneService(
                mock(PageRepository.class),
                mock(PageListService.class),
                new HuntlyProperties(),
                mock(CollectionRepository.class)
        );
        SearchQuery searchQuery = new SearchQuery();
        searchQuery.setQueryOptions("tweet,starred");
        searchQuery.setContentType("feeds");
        searchQuery.setLibraryFilter("unsorted");
        searchQuery.setSearchTitleOnly(true);
        searchQuery.setAlreadyRead(true);

        SearchOption option = luceneService.resolveSearchOption(searchQuery);

        assertThat(option.getType()).isEqualTo(SearchOption.Type.FEEDS);
        assertThat(option.getLibrary()).isEqualTo(SearchOption.Library.UNSORTED);
        assertThat(option.getOnlySearchTitle()).isTrue();
        assertThat(option.getAlreadyRead()).isTrue();
    }

    @Test
    void resolveSearchDateRange_usesStructuredDateFilterFields() {
        LuceneService luceneService = new LuceneService(
                mock(PageRepository.class),
                mock(PageListService.class),
                new HuntlyProperties(),
                mock(CollectionRepository.class)
        );
        SearchQuery searchQuery = new SearchQuery();
        searchQuery.setStartDate("2026-04-01T00:00:00Z");
        searchQuery.setEndDate("2026-04-02T00:00:00Z");
        searchQuery.setDateField("collected_at");

        LuceneService.SearchDateRange dateRange = luceneService.resolveSearchDateRange(searchQuery);

        assertThat(dateRange.getDocField()).isEqualTo(DocFields.COLLECTED_AT);
        assertThat(dateRange.getStartEpochSecond()).isEqualTo(Instant.parse("2026-04-01T00:00:00Z").getEpochSecond());
        assertThat(dateRange.getEndEpochSecond()).isEqualTo(Instant.parse("2026-04-02T00:00:00Z").getEpochSecond() - 1);
    }
}
