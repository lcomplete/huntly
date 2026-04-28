package com.huntly.server.mcp;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.server.mcp.dto.McpPageItem;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class McpUtilsTest {

    @Test
    void toMcpPageItemKeepsCollectionMetadataInTitleOnlyMode() {
        Instant collectedAt = Instant.parse("2026-04-28T10:15:30Z");
        PageItem pageItem = new PageItem();
        pageItem.setId(11L);
        pageItem.setTitle("Collected article");
        pageItem.setUrl("https://example.com/article");
        pageItem.setCollectionId(42L);
        pageItem.setCollectedAt(collectedAt);

        McpPageItem result = new McpUtils().toMcpPageItem(pageItem, true);

        assertThat(result.getId()).isEqualTo(11L);
        assertThat(result.getTitle()).isEqualTo("Collected article");
        assertThat(result.getCollectionId()).isEqualTo(42L);
        assertThat(result.getCollectedAt()).isEqualTo(collectedAt.toString());
    }
}
