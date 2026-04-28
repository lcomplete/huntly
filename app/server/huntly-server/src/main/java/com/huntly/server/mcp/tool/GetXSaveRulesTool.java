package com.huntly.server.mcp.tool;

import com.huntly.interfaces.external.model.LibrarySaveType;
import com.huntly.server.domain.entity.TwitterUserSetting;
import com.huntly.server.domain.vo.CollectionGroupVO;
import com.huntly.server.domain.vo.CollectionTreeVO;
import com.huntly.server.domain.vo.CollectionVO;
import com.huntly.server.service.CollectionService;
import com.huntly.server.service.TwitterUserSettingService;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * MCP Tool: get_x_save_rules - Get configured X/Twitter save rules
 */
@Component
public class GetXSaveRulesTool implements McpTool {

    private final TwitterUserSettingService twitterUserSettingService;
    private final CollectionService collectionService;

    public GetXSaveRulesTool(TwitterUserSettingService twitterUserSettingService,
            CollectionService collectionService) {
        this.twitterUserSettingService = twitterUserSettingService;
        this.collectionService = collectionService;
    }

    @Override
    public String getName() {
        return "get_x_save_rules";
    }

    @Override
    public String getDescription() {
        return "Get Huntly X/Twitter save rules. Use this before analyzing or searching X content to identify which X accounts belong to the user (is_myself=true), and to understand where tweets authored by each account, bookmarks, and likes are saved: My List, Starred, Read Later, Archive, or a specific collection. The returned display_name is the tweet author name indexed by Huntly and can be used with search_content advanced search, for example author:\"Display Name\"; use screen_name only for X account identity, not for author: search.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", new LinkedHashMap<>());
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        List<TwitterUserSetting> settings = twitterUserSettingService.getTwitterUserSettings();
        Map<Long, Map<String, Object>> collectionLookup = buildCollectionLookup(collectionService.getTreeWithoutCounts());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("count", settings.size());
        response.put("my_accounts", settings.stream()
                .filter(setting -> Boolean.TRUE.equals(setting.getMyself()))
                .map(this::toAccountResponse)
                .collect(Collectors.toList()));
        response.put("rules", settings.stream()
                .map(setting -> toRuleResponse(setting, collectionLookup))
                .collect(Collectors.toList()));
        return response;
    }

    private Map<String, Object> toRuleResponse(TwitterUserSetting setting,
            Map<Long, Map<String, Object>> collectionLookup) {
        Map<String, Object> response = toAccountResponse(setting);
        response.put("is_myself", Boolean.TRUE.equals(setting.getMyself()));
        response.put("tweets", toDestinationResponse(
                setting.getTweetToLibraryType(),
                setting.getTweetToCollectionId(),
                collectionLookup));
        response.put("bookmarks", toDestinationResponse(
                setting.getBookmarkToLibraryType(),
                setting.getBookmarkToCollectionId(),
                collectionLookup));
        response.put("likes", toDestinationResponse(
                setting.getLikeToLibraryType(),
                setting.getLikeToCollectionId(),
                collectionLookup));
        return response;
    }

    private Map<String, Object> toAccountResponse(TwitterUserSetting setting) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", setting.getId());
        response.put("display_name", setting.getName());
        response.put("screen_name", setting.getScreenName());
        response.put("author_search_query", buildAuthorSearchQuery(setting.getName()));
        return response;
    }

    private Map<String, Object> toDestinationResponse(Integer saveTypeCode, Long collectionId,
            Map<Long, Map<String, Object>> collectionLookup) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("enabled", isDestinationEnabled(saveTypeCode, collectionId));
        response.put("save_type_code", saveTypeCode);
        response.put("save_type", toConfiguredSaveType(saveTypeCode));
        response.put("effective_save_type", toEffectiveSaveType(saveTypeCode, collectionId));
        response.put("collection", toCollectionResponse(collectionId, collectionLookup));
        return response;
    }

    private boolean isDestinationEnabled(Integer saveTypeCode, Long collectionId) {
        return (saveTypeCode != null && saveTypeCode > 0) || collectionId != null;
    }

    private String toConfiguredSaveType(Integer saveTypeCode) {
        LibrarySaveType saveType = LibrarySaveType.fromCode(saveTypeCode);
        if (saveType == null) {
            return null;
        }
        return toSaveTypeName(saveType);
    }

    private String toEffectiveSaveType(Integer saveTypeCode, Long collectionId) {
        if (collectionId != null && (saveTypeCode == null || saveTypeCode == 0)) {
            return "my_list";
        }
        LibrarySaveType saveType = LibrarySaveType.fromCode(saveTypeCode);
        if (saveType == null || saveType == LibrarySaveType.NONE) {
            return null;
        }
        return toSaveTypeName(saveType);
    }

    private String toSaveTypeName(LibrarySaveType saveType) {
        switch (saveType) {
            case NONE:
                return "none";
            case MY_LIST:
                return "my_list";
            case STARRED:
                return "starred";
            case READ_LATER:
                return "read_later";
            case ARCHIVE:
                return "archive";
            default:
                return null;
        }
    }

    private Map<String, Object> toCollectionResponse(Long collectionId,
            Map<Long, Map<String, Object>> collectionLookup) {
        if (collectionId == null) {
            return null;
        }
        Map<String, Object> collection = collectionLookup.get(collectionId);
        if (collection != null) {
            return new LinkedHashMap<>(collection);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", collectionId);
        response.put("name", null);
        response.put("path", null);
        response.put("group_id", null);
        response.put("group_name", null);
        return response;
    }

    private Map<Long, Map<String, Object>> buildCollectionLookup(CollectionTreeVO tree) {
        Map<Long, Map<String, Object>> lookup = new LinkedHashMap<>();
        for (CollectionGroupVO group : tree.getGroups()) {
            addCollectionsToLookup(lookup, group, group.getCollections(), null);
        }
        return lookup;
    }

    private void addCollectionsToLookup(Map<Long, Map<String, Object>> lookup, CollectionGroupVO group,
            List<CollectionVO> collections, String parentPath) {
        for (CollectionVO collection : collections) {
            String path = StringUtils.isBlank(parentPath) ? collection.getName() : parentPath + "/" + collection.getName();

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("id", collection.getId());
            response.put("name", collection.getName());
            response.put("path", path);
            response.put("group_id", group.getId());
            response.put("group_name", group.getName());
            lookup.put(collection.getId(), response);

            addCollectionsToLookup(lookup, group, collection.getChildren(), path);
        }
    }

    private String buildAuthorSearchQuery(String displayName) {
        if (StringUtils.isBlank(displayName)) {
            return null;
        }
        return "author:\"" + displayName
                .replace("\\", "\\\\")
                .replace("\"", "\\\"") + "\"";
    }
}
