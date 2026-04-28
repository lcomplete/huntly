package com.huntly.server.mcp;

import com.huntly.server.domain.entity.TwitterUserSetting;
import com.huntly.server.domain.vo.CollectionGroupVO;
import com.huntly.server.domain.vo.CollectionTreeVO;
import com.huntly.server.domain.vo.CollectionVO;
import com.huntly.server.mcp.tool.GetXSaveRulesTool;
import com.huntly.server.service.CollectionService;
import com.huntly.server.service.TwitterUserSettingService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GetXSaveRulesToolTest {

    @Test
    void returnsRulesWithOwnAccountsAndSaveDestinations() {
        TwitterUserSettingService twitterUserSettingService = mock(TwitterUserSettingService.class);
        CollectionService collectionService = mock(CollectionService.class);

        CollectionTreeVO tree = new CollectionTreeVO();
        CollectionGroupVO group = new CollectionGroupVO();
        group.setId(1L);
        group.setName("Knowledge");

        CollectionVO parentCollection = new CollectionVO();
        parentCollection.setId(10L);
        parentCollection.setName("X");

        CollectionVO childCollection = new CollectionVO();
        childCollection.setId(42L);
        childCollection.setName("Daily Reads");
        childCollection.setParentId(10L);
        parentCollection.setChildren(List.of(childCollection));

        group.setCollections(List.of(parentCollection));
        tree.setGroups(List.of(group));
        when(collectionService.getTreeWithoutCounts()).thenReturn(tree);

        TwitterUserSetting myAccount = new TwitterUserSetting();
        myAccount.setId(7);
        myAccount.setName("Jane Doe");
        myAccount.setScreenName("jane");
        myAccount.setMyself(true);
        myAccount.setTweetToLibraryType(2);
        myAccount.setBookmarkToCollectionId(42L);
        myAccount.setLikeToLibraryType(4);

        TwitterUserSetting otherAccount = new TwitterUserSetting();
        otherAccount.setId(8);
        otherAccount.setName("Open Source News");
        otherAccount.setScreenName("oss_news");
        otherAccount.setMyself(false);
        otherAccount.setTweetToLibraryType(1);

        when(twitterUserSettingService.getTwitterUserSettings()).thenReturn(List.of(myAccount, otherAccount));

        GetXSaveRulesTool tool = new GetXSaveRulesTool(twitterUserSettingService, collectionService);
        Map<String, Object> response = asMap(tool.execute(Map.of()));

        assertThat(response.get("count")).isEqualTo(2);

        List<Map<String, Object>> myAccounts = asMapList(response.get("my_accounts"));
        assertThat(myAccounts).hasSize(1);
        assertThat(myAccounts.get(0))
                .containsEntry("display_name", "Jane Doe")
                .containsEntry("screen_name", "jane")
                .containsEntry("author_search_query", "author:\"Jane Doe\"");

        List<Map<String, Object>> rules = asMapList(response.get("rules"));
        Map<String, Object> rule = rules.get(0);
        assertThat(rule)
                .containsEntry("display_name", "Jane Doe")
                .containsEntry("is_myself", true);

        Map<String, Object> tweets = asMap(rule.get("tweets"));
        assertThat(tweets)
                .containsEntry("enabled", true)
                .containsEntry("save_type", "starred")
                .containsEntry("effective_save_type", "starred");

        Map<String, Object> bookmarks = asMap(rule.get("bookmarks"));
        assertThat(bookmarks)
                .containsEntry("enabled", true)
                .containsEntry("save_type", null)
                .containsEntry("effective_save_type", "my_list");
        assertThat(asMap(bookmarks.get("collection")))
                .containsEntry("id", 42L)
                .containsEntry("name", "Daily Reads")
                .containsEntry("path", "X/Daily Reads")
                .containsEntry("group_name", "Knowledge");

        Map<String, Object> likes = asMap(rule.get("likes"));
        assertThat(likes)
                .containsEntry("save_type", "archive")
                .containsEntry("effective_save_type", "archive");
    }

    @Test
    void descriptionExplainsAuthorSearchUsage() {
        GetXSaveRulesTool tool = new GetXSaveRulesTool(
                mock(TwitterUserSettingService.class),
                mock(CollectionService.class));

        assertThat(tool.getName()).isEqualTo("get_x_save_rules");
        assertThat(tool.getDescription())
                .contains("is_myself=true")
                .contains("author:\"Display Name\"")
                .contains("screen_name only for X account identity");
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
