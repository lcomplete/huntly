package com.huntly.server.service;

import com.huntly.interfaces.external.dto.CursorPageResult;
import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.model.ContentType;
import com.huntly.interfaces.external.query.PageListQuery;
import com.huntly.interfaces.external.query.PageListSort;
import com.huntly.jpa.spec.Sorts;
import com.huntly.jpa.spec.Specifications;
import com.huntly.server.cache.CacheService;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.mapper.PageItemMapper;
import com.huntly.server.repository.PageRepository;
import com.huntly.server.util.PageSizeUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * @author lcomplete
 */
@Service
public class PageListService {

    private final PageRepository pageRepository;

    private final CacheService cacheService;

    public PageListService(PageRepository pageRepository, CacheService cacheService) {
        this.pageRepository = pageRepository;
        this.cacheService = cacheService;
    }

    public CursorPageResult getCursorPageResult(PageListQuery listQuery) {
        List<PageItem> pageItems = getPageItems(listQuery);

        //result
        CursorPageResult cursorPageResult = new CursorPageResult();
        cursorPageResult.setPageItems(pageItems);
        if (!CollectionUtils.isEmpty(pageItems)) {
            cursorPageResult.setFirstId(pageItems.get(0).getRecordAt());
            cursorPageResult.setLastId(pageItems.get(pageItems.size() - 1).getRecordAt());
        }

        return cursorPageResult;
    }

    public List<PageItem> getPageItems(PageListQuery listQuery) {
        //query
        var listSort = PageListSort.LAST_READ_AT;
        if (listQuery.getSort() != null) {
            listSort = listQuery.getSort();
        }
        var sortField = listSort.getSortField();
        // For tweets sorted by VOTE_SCORE, use CONNECTED_AT (tweet publish time) for date filtering
        // For other content types, use CREATED_AT (system creation time)
        var sortFilterField = sortField;
        if (listSort.equals(PageListSort.VOTE_SCORE)) {
            boolean isTweetQuery = (listQuery.getContentFilterType() != null && listQuery.getContentFilterType() == 2)
                    || listQuery.getContentType() == ContentType.TWEET
                    || listQuery.getContentType() == ContentType.QUOTED_TWEET;
            sortFilterField = isTweetQuery ? PageListSort.CONNECTED_AT.getSortField() : PageListSort.CREATED_AT.getSortField();
        }
        var specs = Specifications.<Page>and()
                .ne(StringUtils.isNotBlank(sortField), sortField, (Object) null)
                .gt(listQuery.getLastRecordAt() != null && listQuery.isAsc(), sortField, listQuery.getLastRecordAt())
                .lt(listQuery.getLastRecordAt() != null && !listQuery.isAsc(), sortField, listQuery.getLastRecordAt())
                .lt(listQuery.getFirstRecordAt() != null && listQuery.isAsc(), sortField, listQuery.getFirstRecordAt())
                .gt(listQuery.getFirstRecordAt() != null && !listQuery.isAsc(), sortField, listQuery.getFirstRecordAt())
                .gt(listQuery.getLastVoteScore() != null && listQuery.isAsc(), sortField, listQuery.getLastVoteScore())
                .lt(listQuery.getLastVoteScore() != null && !listQuery.isAsc(), sortField, listQuery.getLastVoteScore())
                .lt(listQuery.getFirstVoteScore() != null && listQuery.isAsc(), sortField, listQuery.getFirstVoteScore())
                .gt(listQuery.getFirstVoteScore() != null && !listQuery.isAsc(), sortField, listQuery.getFirstVoteScore())
                .eq(listQuery.getSourceId() > 0, "sourceId", listQuery.getSourceId())
                .eq(listQuery.getFolderId() > 0, "folderId", listQuery.getFolderId())
                .eq(listQuery.getConnectorType() != null, "connectorType", listQuery.getConnectorType())
                .eq(listQuery.getConnectorId() > 0, "connectorId", listQuery.getConnectorId())
                .eq(listQuery.getStarred() != null, "starred", listQuery.getStarred())
                .eq(listQuery.getReadLater() != null, "readLater", listQuery.getReadLater())
                .eq(listQuery.getMarkRead() != null, "markRead", listQuery.getMarkRead())
                .eq(listQuery.getSaveStatus() != null, "librarySaveStatus", listQuery.getSaveStatus() != null ? listQuery.getSaveStatus().getCode() : null)
                .eq(listQuery.getContentType() != null, "contentType", listQuery.getContentType() != null ? listQuery.getContentType().getCode() : null)
                .in(listQuery.getContentFilterType() != null && listQuery.getContentFilterType() == 2, "contentType", Arrays.asList(ContentType.TWEET.getCode(), ContentType.QUOTED_TWEET.getCode()))
                .eq(listQuery.getContentFilterType() != null && listQuery.getContentFilterType() == 4, "contentType", ContentType.SNIPPET.getCode())
                .predicate(listQuery.getContentFilterType() != null && listQuery.getContentFilterType() == 1, Specifications.<Page>or()
                        .eq("contentType", ContentType.BROWSER_HISTORY.getCode())
                        .eq("contentType", (Object) null)
                        .build()
                )
                .ge(StringUtils.isNotBlank(listQuery.getStartDate()), sortFilterField, convertDateToInstant(listQuery.getStartDate(), 0))
                .lt(StringUtils.isNotBlank(listQuery.getEndDate()), sortFilterField, listQuery.getEndDate() != null ? convertDateToInstant(listQuery.getEndDate(), 1) : null)
                .gt(Boolean.TRUE.equals(listQuery.getHasHighlights()), "highlightCount", 0)
                .build();
        var sort = (listQuery.isAsc() ? Sorts.builder().asc(sortField) : Sorts.builder().desc(sortField)).build();
        var size = PageSizeUtils.getPageSize(listQuery.getCount());
        List<Page> pages = pageRepository.findAll(specs, size, sort);
        //todo enhance query

        //mapper
        PageListSort finalListSort = listSort;
        List<PageItem> pageItems = pages.stream().map(page -> {
            PageItem item = PageItemMapper.INSTANCE.fromPage(page);
            PageItemMapper.INSTANCE.updateRecordAt(item, page, finalListSort);
            return updatePageItemRelationData(item);
        }).collect(Collectors.toList());
        return pageItems;
    }

    private Instant convertDateToInstant(String strDate, int plusDay) {
        if (strDate == null) {
            return null;
        }
        if (strDate.contains("T") || strDate.contains(":")) {
            return parseDateTimeInstant(strDate);
        }
        try {
            // Use system default timezone to be consistent with InstantStringConverter
            return LocalDate.parse(strDate).atStartOfDay(ZoneId.systemDefault()).toInstant().plus(plusDay, ChronoUnit.DAYS);
        } catch (DateTimeParseException e) {
            try {
                return new SimpleDateFormat("yyyy-MM-dd").parse(strDate).toInstant().plus(plusDay, ChronoUnit.DAYS);
            } catch (ParseException parseException) {
                throw new RuntimeException(parseException);
            }
        }
    }

    private Instant parseDateTimeInstant(String strDateTime) {
        try {
            return Instant.parse(strDateTime);
        } catch (DateTimeParseException e) {
            try {
                return OffsetDateTime.parse(strDateTime).toInstant();
            } catch (DateTimeParseException offsetException) {
                try {
                    // Use system default timezone to be consistent with InstantStringConverter
                    return LocalDateTime.parse(strDateTime).atZone(ZoneId.systemDefault()).toInstant();
                } catch (DateTimeParseException localException) {
                    throw new RuntimeException(localException);
                }
            }
        }
    }

    public PageItem updatePageItemRelationData(PageItem item) {
        if (item.getConnectorId() != null && item.getConnectorId() > 0) {
            var connector = cacheService.getConnector(item.getConnectorId());
            connector.ifPresent(value -> PageItemMapper.INSTANCE.updateFromConnector(item, value));
        }
        if (StringUtils.isBlank(item.getSiteName()) && item.getSourceId() != null && item.getSourceId() > 0) {
            var source = cacheService.getSource(item.getSourceId());
            source.ifPresent(value -> PageItemMapper.INSTANCE.updateFromSource(item, value));
        }
        return item;
    }


}
