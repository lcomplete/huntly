package com.huntly.server.service;

import com.huntly.interfaces.external.dto.BatchFilterResult;
import com.huntly.interfaces.external.dto.BatchMoveRequest;
import com.huntly.interfaces.external.dto.BatchMoveResult;
import com.huntly.interfaces.external.dto.BatchPageItem;
import com.huntly.interfaces.external.model.ContentType;
import com.huntly.interfaces.external.model.LibrarySaveStatus;
import com.huntly.interfaces.external.query.BatchFilterQuery;
import com.huntly.jpa.spec.Specifications;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.repository.PageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.criteria.CriteriaBuilder;
import javax.persistence.criteria.CriteriaUpdate;
import javax.persistence.criteria.Predicate;
import javax.persistence.criteria.Root;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service for batch organizing pages in library.
 *
 * @author lcomplete
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BatchOrganizeService {

    private final PageRepository pageRepository;

    @PersistenceContext
    private EntityManager entityManager;

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int DESCRIPTION_MAX_LENGTH = 150;

    private static final int MAX_PAGE_SIZE = 500;

    /**
     * Filter pages with pagination.
     */
    public BatchFilterResult filterPages(BatchFilterQuery query) {
        if (query == null) {
            return BatchFilterResult.of(0, List.of(), 0, 0);
        }

        Specification<Page> spec = buildSpecification(query);

        // Validate and clamp page/size to prevent invalid PageRequest
        int page = query.getPage() != null ? Math.max(0, query.getPage()) : 0;
        int size = query.getSize() != null ? query.getSize() : DEFAULT_PAGE_SIZE;
        size = Math.max(1, Math.min(size, MAX_PAGE_SIZE)); // Clamp between 1 and MAX_PAGE_SIZE

        long totalCount = pageRepository.count(spec);
        int totalPages = (int) Math.ceil((double) totalCount / size);

        org.springframework.data.domain.Page<Page> pageResult = pageRepository.findAll(spec, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        List<BatchPageItem> items = pageResult.getContent().stream()
                .map(this::toBatchPageItem)
                .collect(Collectors.toList());

        return BatchFilterResult.of(totalCount, items, page, totalPages);
    }

    private BatchPageItem toBatchPageItem(Page p) {
        return BatchPageItem.builder()
                .id(p.getId())
                .contentType(p.getContentType())
                .title(p.getTitle())
                .description(truncateDescription(p.getDescription()))
                .url(p.getUrl())
                .author(p.getAuthor())
                .pageJsonProperties(p.getPageJsonProperties())
                .collectedAt(p.getCollectedAt())
                .publishTime(p.getConnectedAt())
                .build();
    }

    private String truncateDescription(String description) {
        if (StringUtils.isBlank(description)) {
            return null;
        }
        if (description.length() <= DESCRIPTION_MAX_LENGTH) {
            return description;
        }
        return description.substring(0, DESCRIPTION_MAX_LENGTH) + "...";
    }

    /**
     * Batch move pages to a collection.
     */
    @Transactional
    public BatchMoveResult batchMoveToCollection(BatchMoveRequest request) {
        if (request.isSelectAll()) {
            // Use bulk SQL update for better performance
            return batchMoveByFilter(request);
        } else {
            // Use bulk SQL update for selected IDs
            return batchMoveByIds(request.getPageIds(), request.getTargetCollectionId(), request.getCollectedAtMode());
        }
    }

    private BatchMoveResult batchMoveByFilter(BatchMoveRequest request) {
        BatchFilterQuery query = request.getFilterQuery();
        if (query == null) {
            log.warn("batchMoveByFilter called with selectAll=true but filterQuery is null");
            return BatchMoveResult.of(0, 0);
        }
        Long targetCollectionId = request.getTargetCollectionId();
        String mode = StringUtils.isBlank(request.getCollectedAtMode()) ? "KEEP" : request.getCollectedAtMode().toUpperCase();

        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaUpdate<Page> update = cb.createCriteriaUpdate(Page.class);
        Root<Page> root = update.from(Page.class);

        // Reuse the same specification used for querying
        Specification<Page> spec = buildSpecification(query);
        Predicate predicate = spec.toPredicate(root, null, cb);
        if (predicate != null) {
            update.where(predicate);
        }

        // Set collectionId - pages are already in library, no need to update librarySaveStatus/savedAt
        update.set(root.<Long>get("collectionId"), targetCollectionId);

        // Handle collectedAt based on mode
        if ("USE_PUBLISH_TIME".equals(mode)) {
            // Set collectedAt to publish time (connectedAt), fallback to original collectedAt, then createdAt
            update.set(root.<Instant>get("collectedAt"),
                    cb.coalesce(
                            cb.coalesce(root.<Instant>get("connectedAt"), root.<Instant>get("collectedAt")),
                            root.<Instant>get("createdAt")
                    ).as(Instant.class));
        } else {
            // KEEP mode: keep original collectedAt, fallback to createdAt if null
            update.set(root.<Instant>get("collectedAt"),
                    cb.coalesce(root.<Instant>get("collectedAt"), root.<Instant>get("createdAt")).as(Instant.class));
        }

        int updated = entityManager.createQuery(update).executeUpdate();
        return BatchMoveResult.of(updated, updated);
    }

    private BatchMoveResult batchMoveByIds(List<Long> pageIds, Long targetCollectionId, String collectedAtMode) {
        if (pageIds == null || pageIds.isEmpty()) {
            return BatchMoveResult.of(0, 0);
        }

        int updated;
        String mode = StringUtils.isBlank(collectedAtMode) ? "KEEP" : collectedAtMode.toUpperCase();

        if ("USE_PUBLISH_TIME".equals(mode)) {
            updated = pageRepository.batchUpdateCollectionWithPublishTime(pageIds, targetCollectionId);
        } else {
            // KEEP mode: don't modify collectedAt, pages are already in library
            updated = pageRepository.batchUpdateCollection(pageIds, targetCollectionId);
        }

        return BatchMoveResult.of(updated, pageIds.size());
    }

    private Specification<Page> buildSpecification(BatchFilterQuery query) {
        // Parse dates upfront - only apply filter if parsing succeeds
        Instant startInstant = convertDateToInstant(query.getStartDate(), 0);
        Instant endInstant = convertDateToInstant(query.getEndDate(), 1);

        var specs = Specifications.<Page>and()
                // Library save status filter
                .predicate(StringUtils.isNotBlank(query.getSaveStatus()) && !"ALL".equalsIgnoreCase(query.getSaveStatus()),
                        buildSaveStatusSpec(query.getSaveStatus()))
                // Must be in library (SAVED or ARCHIVED)
                .gt("librarySaveStatus", LibrarySaveStatus.NOT_SAVED.getCode())
                // Content type filter
                .predicate(StringUtils.isNotBlank(query.getContentType()) && !"ALL".equalsIgnoreCase(query.getContentType()),
                        buildContentTypeSpec(query.getContentType()))
                // Collection filter
                .eq(query.getCollectionId() != null && !Boolean.TRUE.equals(query.getFilterUnsorted()),
                        "collectionId", query.getCollectionId())
                .predicate(Boolean.TRUE.equals(query.getFilterUnsorted()),
                        Specifications.<Page>and().eq("collectionId", (Object) null).build())
                // Starred filter
                .eq(Boolean.TRUE.equals(query.getStarred()), "starred", true)
                // Read later filter
                .eq(Boolean.TRUE.equals(query.getReadLater()), "readLater", true)
                // Author filter (case-insensitive partial match)
                .predicate(StringUtils.isNotBlank(query.getAuthor()), buildAuthorSpec(query.getAuthor()))
                // Date range filter - only add when parsing succeeds (non-null)
                .ge(startInstant != null, "createdAt", startInstant)
                .lt(endInstant != null, "createdAt", endInstant);

        return specs.build();
    }

    private Specification<Page> buildSaveStatusSpec(String saveStatus) {
        if (StringUtils.isBlank(saveStatus) || "ALL".equalsIgnoreCase(saveStatus)) {
            return null;
        }
        if ("SAVED".equalsIgnoreCase(saveStatus)) {
            return Specifications.<Page>and().eq("librarySaveStatus", LibrarySaveStatus.SAVED.getCode()).build();
        }
        if ("ARCHIVED".equalsIgnoreCase(saveStatus)) {
            return Specifications.<Page>and().eq("librarySaveStatus", LibrarySaveStatus.ARCHIVED.getCode()).build();
        }
        return null;
    }

    private Specification<Page> buildContentTypeSpec(String contentType) {
        if (StringUtils.isBlank(contentType) || "ALL".equalsIgnoreCase(contentType)) {
            return null;
        }
        List<Integer> codes = new ArrayList<>();
        switch (contentType.toUpperCase()) {
            case "ARTICLE":
                codes.add(ContentType.BROWSER_HISTORY.getCode());
                codes.add(ContentType.MARKDOWN.getCode());
                // For articles, null contentType is also considered as article
                return Specifications.<Page>or()
                        .in("contentType", codes)
                        .eq("contentType", (Object) null)
                        .build();
            case "TWEET":
                codes.add(ContentType.TWEET.getCode());
                codes.add(ContentType.QUOTED_TWEET.getCode());
                return Specifications.<Page>and().in("contentType", codes).build();
            case "SNIPPET":
                codes.add(ContentType.SNIPPET.getCode());
                return Specifications.<Page>and().in("contentType", codes).build();
            default:
                return null;
        }
    }

    private Specification<Page> buildAuthorSpec(String author) {
        if (StringUtils.isBlank(author)) {
            return null;
        }
        // Case-insensitive partial match on author field
        return (root, query, cb) -> cb.like(cb.lower(root.get("author")), "%" + author.toLowerCase() + "%");
    }

    private Instant convertDateToInstant(String strDate, int plusDay) {
        if (StringUtils.isBlank(strDate)) {
            return null;
        }
        try {
            return LocalDate.parse(strDate).atStartOfDay(ZoneId.systemDefault()).toInstant()
                    .plus(plusDay, ChronoUnit.DAYS);
        } catch (Exception e) {
            log.warn("Failed to parse date: {}", strDate);
            return null;
        }
    }
}

