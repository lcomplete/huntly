package com.huntly.server.domain.mapper;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.query.PageListSort;
import com.huntly.server.domain.entity.Connector;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.entity.Source;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;
import org.mapstruct.factory.Mappers;

@Mapper
public interface PageItemMapper {
    PageItemMapper INSTANCE = Mappers.getMapper(PageItemMapper.class);

    PageItem fromPage(Page page);

    default PageItem updateRecordAt(@MappingTarget PageItem item, Page page, PageListSort listSort) {
        switch (listSort) {
            case SAVED_AT:
                item.setRecordAt(page.getSavedAt());
                break;
            case VOTE_SCORE:
            case CREATED_AT:
                item.setRecordAt(page.getCreatedAt());
                break;
            case STARRED_AT:
                item.setRecordAt(page.getStarredAt());
                break;
            case READ_LATER_AT:
                item.setRecordAt(page.getReadLaterAt());
                break;
            case ARCHIVED_AT:
                item.setRecordAt(page.getArchivedAt());
                break;
            case CONNECTED_AT:
                item.setRecordAt(page.getConnectedAt());
                break;
            case COLLECTED_AT:
                item.setRecordAt(page.getCollectedAt());
                break;
            case UNSORTED_SAVED_AT:
                // Fallback: collectedAt -> savedAt -> archivedAt
                item.setRecordAt(coalesce(page.getCollectedAt(), page.getSavedAt(), page.getArchivedAt()));
                break;
            case LAST_READ_AT:
            default:
                item.setRecordAt(page.getLastReadAt());
                break;
        }
        return item;
    }

    default java.time.Instant coalesce(java.time.Instant... values) {
        for (java.time.Instant value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    default PageItem updateFromSource(@MappingTarget PageItem pageItem, Source source) {
        pageItem.setSiteName(source.getSiteName());
        pageItem.setDomain(source.getDomain());
        pageItem.setFaviconUrl(source.getFaviconUrl());

        return pageItem;
    }

    default PageItem updateFromConnector(@MappingTarget PageItem pageItem, Connector connector) {
        pageItem.setSiteName(connector.getName());
        pageItem.setFaviconUrl(connector.getIconUrl());

        return pageItem;
    }
}
