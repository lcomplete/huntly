package com.huntly.server.mcp;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.model.LibrarySaveStatus;
import com.huntly.interfaces.external.query.PageListQuery;
import com.huntly.interfaces.external.query.PageListSort;
import com.huntly.server.domain.vo.CollectionGroupVO;
import com.huntly.server.domain.vo.CollectionTreeVO;
import com.huntly.server.domain.vo.CollectionVO;
import com.huntly.server.mcp.tool.ListCollectionContentTool;
import com.huntly.server.mcp.tool.ListCollectionsTool;
import com.huntly.server.service.CollectionService;
import com.huntly.server.service.PageListService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CollectionMcpToolsTest {

    @Test
    void listCollectionsReturnsAgentFriendlyTree() {
        CollectionService collectionService = mock(CollectionService.class);
        CollectionTreeVO tree = new CollectionTreeVO();
        tree.setUnsortedCount(3L);

        CollectionGroupVO group = new CollectionGroupVO();
        group.setId(1L);
        group.setName("Knowledge");
        group.setDisplaySequence(2);

        CollectionVO collection = new CollectionVO();
        collection.setId(42L);
        collection.setGroupId(1L);
        collection.setName("Daily Reads");
        collection.setPageCount(8L);
        group.setCollections(List.of(collection));
        tree.setGroups(List.of(group));

        when(collectionService.getTree()).thenReturn(tree);

        ListCollectionsTool tool = new ListCollectionsTool(collectionService);
        Map<String, Object> response = asMap(tool.execute(Map.of()));

        assertThat(response.get("unsorted_count")).isEqualTo(3L);
        List<Map<String, Object>> groups = asMapList(response.get("groups"));
        assertThat(groups).hasSize(1);
        assertThat(groups.get(0)).containsEntry("name", "Knowledge");

        List<Map<String, Object>> collections = asMapList(groups.get(0).get("collections"));
        assertThat(collections.get(0))
                .containsEntry("id", 42L)
                .containsEntry("name", "Daily Reads")
                .containsEntry("page_count", 8L);
    }

    @Test
    void listCollectionContentBuildsCollectionQuery() {
        PageListService pageListService = mock(PageListService.class);
        PageItem pageItem = new PageItem();
        pageItem.setId(9L);
        pageItem.setTitle("Collected item");
        pageItem.setCollectionId(42L);
        when(pageListService.getPageItems(any(PageListQuery.class))).thenReturn(List.of(pageItem));

        ListCollectionContentTool tool = new ListCollectionContentTool(pageListService, new McpUtils());
        Map<String, Object> response = asMap(tool.execute(Map.of(
                "collection_id", 42,
                "source_type", "tweet",
                "limit", 10
        )));

        ArgumentCaptor<PageListQuery> queryCaptor = ArgumentCaptor.forClass(PageListQuery.class);
        verify(pageListService).getPageItems(queryCaptor.capture());
        PageListQuery query = queryCaptor.getValue();
        assertThat(query.getCollectionId()).isEqualTo(42L);
        assertThat(query.getFilterUnsorted()).isNull();
        assertThat(query.getSort()).isEqualTo(PageListSort.COLLECTED_AT);
        assertThat(query.getSaveStatus()).isEqualTo(LibrarySaveStatus.SAVED);
        assertThat(query.getIncludeArchived()).isTrue();
        assertThat(query.getContentFilterType()).isEqualTo(2);
        assertThat(query.getCount()).isEqualTo(10);

        assertThat(response.get("count")).isEqualTo(1);
        assertThat(response.get("collection_id")).isEqualTo(42L);
        assertThat(response.get("unsorted")).isEqualTo(false);
    }

    @Test
    void listCollectionContentBuildsUnsortedQuery() {
        PageListService pageListService = mock(PageListService.class);
        when(pageListService.getPageItems(any(PageListQuery.class))).thenReturn(List.of());

        ListCollectionContentTool tool = new ListCollectionContentTool(pageListService, new McpUtils());
        tool.execute(Map.of("unsorted", true, "limit", 5));

        ArgumentCaptor<PageListQuery> queryCaptor = ArgumentCaptor.forClass(PageListQuery.class);
        verify(pageListService).getPageItems(queryCaptor.capture());
        PageListQuery query = queryCaptor.getValue();
        assertThat(query.getCollectionId()).isNull();
        assertThat(query.getFilterUnsorted()).isTrue();
        assertThat(query.getSort()).isEqualTo(PageListSort.UNSORTED_SAVED_AT);
        assertThat(query.getCount()).isEqualTo(5);
    }

    @Test
    void listCollectionContentRejectsAmbiguousTarget() {
        ListCollectionContentTool tool = new ListCollectionContentTool(mock(PageListService.class), new McpUtils());

        Map<String, Object> response = asMap(tool.execute(Map.of(
                "collection_id", 42,
                "unsorted", true
        )));

        assertThat(response.get("error")).isEqualTo("Use either collection_id or unsorted, not both");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asMapList(Object value) {
        return (List<Map<String, Object>>) value;
    }
}
