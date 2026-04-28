package com.huntly.server.mcp;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.dto.PageSearchResult;
import com.huntly.interfaces.external.query.SearchQuery;
import com.huntly.server.mcp.dto.McpPageItem;
import com.huntly.server.mcp.tool.SearchContentTool;
import com.huntly.server.service.LuceneService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SearchContentToolTest {

    @Test
    void inputSchemaDocumentsAdvancedSearchQuotingAndUnsortedPagination() {
        SearchContentTool tool = new SearchContentTool(mock(LuceneService.class), new McpUtils());

        Map<String, Object> schema = tool.getInputSchema();
        Map<String, Object> properties = asMap(schema.get("properties"));
        Map<String, Object> query = asMap(properties.get("query"));
        Map<String, Object> libraryFilter = asMap(properties.get("library_filter"));
        Map<String, Object> dateField = asMap(properties.get("date_field"));
        Map<String, Object> page = asMap(properties.get("page"));

        assertThat(tool.getDescription())
                .contains("collection:\"Daily Reads\"")
                .contains("author:\"Jane Doe\"");
        assertThat((String) query.get("description"))
                .contains("collection:\"Daily Reads\"")
                .contains("Wrap values containing spaces in double quotes");
        assertThat(asList(libraryFilter.get("enum"))).contains("unsorted");
        assertThat(properties).containsKeys("start_date", "end_date", "date_field");
        assertThat(asList(dateField.get("enum"))).contains("created_at", "collected_at", "last_read_at");
        assertThat(properties).containsKey("page");
        assertThat(page.get("maximum")).isEqualTo(20);
    }

    @Test
    void executeMapsFiltersAndReturnsPaginationMetadata() {
        LuceneService luceneService = mock(LuceneService.class);
        SearchContentTool tool = new SearchContentTool(luceneService, new McpUtils());
        PageSearchResult searchResult = new PageSearchResult();
        PageItem pageItem = new PageItem();
        pageItem.setId(7L);
        pageItem.setTitle("Search result");
        searchResult.setItems(List.of(pageItem));
        searchResult.setPage(2);
        searchResult.setTotalHits(101);
        searchResult.setCostSeconds(0.25);
        when(luceneService.searchPages(any(SearchQuery.class))).thenReturn(searchResult);

        Object rawResponse = tool.execute(Map.of(
                "query", "machine learning",
                "content_type", "feeds",
                "library_filter", "unsorted",
                "search_title_only", true,
                "already_read", true,
                "start_date", "2026-04-01",
                "end_date", "2026-04-28",
                "date_field", "collected_at",
                "limit", 25,
                "page", 2
        ));

        ArgumentCaptor<SearchQuery> queryCaptor = ArgumentCaptor.forClass(SearchQuery.class);
        verify(luceneService).searchPages(queryCaptor.capture());
        SearchQuery searchQuery = queryCaptor.getValue();
        assertThat(searchQuery.getQ()).isEqualTo("machine learning");
        assertThat(searchQuery.getSize()).isEqualTo(25);
        assertThat(searchQuery.getPage()).isEqualTo(2);
        assertThat(searchQuery.getContentType()).isEqualTo("feeds");
        assertThat(searchQuery.getLibraryFilter()).isEqualTo("unsorted");
        assertThat(searchQuery.getSearchTitleOnly()).isTrue();
        assertThat(searchQuery.getAlreadyRead()).isTrue();
        assertThat(searchQuery.getStartDate()).isEqualTo("2026-04-01");
        assertThat(searchQuery.getEndDate()).isEqualTo("2026-04-28");
        assertThat(searchQuery.getDateField()).isEqualTo("collected_at");
        assertThat(searchQuery.getQueryOptions()).isEqualTo("feeds,unsorted,title,read");

        Map<String, Object> response = asMap(rawResponse);
        assertThat(response.get("total_hits")).isEqualTo(101L);
        assertThat(response.get("page")).isEqualTo(2);
        assertThat(response.get("page_size")).isEqualTo(25);
        assertThat(response.get("total_pages")).isEqualTo(5L);
        assertThat(response.get("has_more")).isEqualTo(true);
        assertThat(response.get("cost_seconds")).isEqualTo(0.25);

        List<McpPageItem> items = asPageItems(response.get("items"));
        assertThat(items).extracting(McpPageItem::getId).containsExactly(7L);
    }

    @Test
    void executeClampsPageToSafeMaximumForLuceneCollection() {
        LuceneService luceneService = mock(LuceneService.class);
        SearchContentTool tool = new SearchContentTool(luceneService, new McpUtils());
        PageSearchResult searchResult = new PageSearchResult();
        searchResult.setItems(List.of());
        when(luceneService.searchPages(any(SearchQuery.class))).thenReturn(searchResult);

        Object rawResponse = tool.execute(Map.of(
                "query", "machine learning",
                "limit", 500,
                "page", Integer.MAX_VALUE
        ));

        ArgumentCaptor<SearchQuery> queryCaptor = ArgumentCaptor.forClass(SearchQuery.class);
        verify(luceneService).searchPages(queryCaptor.capture());
        SearchQuery searchQuery = queryCaptor.getValue();
        assertThat(searchQuery.getSize()).isEqualTo(500);
        assertThat(searchQuery.getPage()).isEqualTo(20);

        Map<String, Object> response = asMap(rawResponse);
        assertThat(response.get("page")).isEqualTo(20);
        assertThat(response.get("page_size")).isEqualTo(500);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private List<String> asList(Object value) {
        return (List<String>) value;
    }

    @SuppressWarnings("unchecked")
    private List<McpPageItem> asPageItems(Object value) {
        return (List<McpPageItem>) value;
    }
}
