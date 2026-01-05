package com.huntly.server.repository;

import com.huntly.jpa.repository.JpaRepositoryWithLimit;
import com.huntly.jpa.repository.JpaSpecificationExecutorWithProjection;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.projection.PageMetaProjection;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface PageRepository extends JpaRepository<Page, Long>, JpaSpecificationExecutor<Page>, JpaSpecificationExecutorWithProjection<Page>, JpaRepositoryWithLimit<Page, Long> {

    // ============= 高性能同步 API 投影查询 =============

    /**
     * Saved 分类查询 (librarySaveStatus IN (1, 2))
     */
    @Query("SELECT p.id AS id, p.title AS title, p.url AS url, p.author AS author, " +
           "p.authorScreenName AS authorScreenName, p.description AS description, " +
           "p.connectorType AS connectorType, p.connectorId AS connectorId, p.folderId AS folderId, " +
           "p.contentType AS contentType, p.librarySaveStatus AS librarySaveStatus, " +
           "p.starred AS starred, p.readLater AS readLater, p.savedAt AS savedAt, " +
           "p.updatedAt AS updatedAt, p.createdAt AS createdAt, p.lastReadAt AS lastReadAt, " +
           "p.archivedAt AS archivedAt, p.thumbUrl AS thumbUrl, p.highlightCount AS highlightCount, " +
           "p.pageJsonProperties AS pageJsonProperties " +
           "FROM Page p WHERE p.librarySaveStatus IN (1, 2) " +
           "AND (:updatedAfter IS NULL OR p.updatedAt > :updatedAfter) " +
           "AND (:cursorAt IS NULL OR p.updatedAt < :cursorAt OR (p.updatedAt = :cursorAt AND p.id < :cursorId)) " +
           "ORDER BY p.updatedAt DESC, p.id DESC")
    List<PageMetaProjection> findSavedMeta(
            @Param("updatedAfter") Instant updatedAfter,
            @Param("cursorAt") Instant cursorAt,
            @Param("cursorId") Long cursorId,
            Pageable pageable);

    /**
     * Twitter/X 分类查询 (contentType IN (8, 9))
     */
    @Query("SELECT p.id AS id, p.title AS title, p.url AS url, p.author AS author, " +
           "p.authorScreenName AS authorScreenName, p.description AS description, " +
           "p.connectorType AS connectorType, p.connectorId AS connectorId, p.folderId AS folderId, " +
           "p.contentType AS contentType, p.librarySaveStatus AS librarySaveStatus, " +
           "p.starred AS starred, p.readLater AS readLater, p.savedAt AS savedAt, " +
           "p.updatedAt AS updatedAt, p.createdAt AS createdAt, p.lastReadAt AS lastReadAt, " +
           "p.archivedAt AS archivedAt, p.thumbUrl AS thumbUrl, p.highlightCount AS highlightCount, " +
           "p.pageJsonProperties AS pageJsonProperties " +
           "FROM Page p WHERE p.contentType IN (8, 9) " +
           "AND (:updatedAfter IS NULL OR p.updatedAt > :updatedAfter) " +
           "AND (:cursorAt IS NULL OR p.updatedAt < :cursorAt OR (p.updatedAt = :cursorAt AND p.id < :cursorId)) " +
           "ORDER BY p.updatedAt DESC, p.id DESC")
    List<PageMetaProjection> findTwitterMeta(
            @Param("updatedAfter") Instant updatedAfter,
            @Param("cursorAt") Instant cursorAt,
            @Param("cursorId") Long cursorId,
            Pageable pageable);

    /**
     * GitHub 分类查询 (connectorType = 2)
     */
    @Query("SELECT p.id AS id, p.title AS title, p.url AS url, p.author AS author, " +
           "p.authorScreenName AS authorScreenName, p.description AS description, " +
           "p.connectorType AS connectorType, p.connectorId AS connectorId, p.folderId AS folderId, " +
           "p.contentType AS contentType, p.librarySaveStatus AS librarySaveStatus, " +
           "p.starred AS starred, p.readLater AS readLater, p.savedAt AS savedAt, " +
           "p.updatedAt AS updatedAt, p.createdAt AS createdAt, p.lastReadAt AS lastReadAt, " +
           "p.archivedAt AS archivedAt, p.thumbUrl AS thumbUrl, p.highlightCount AS highlightCount, " +
           "p.pageJsonProperties AS pageJsonProperties " +
           "FROM Page p WHERE p.connectorType = 2 " +
           "AND (:updatedAfter IS NULL OR p.updatedAt > :updatedAfter) " +
           "AND (:cursorAt IS NULL OR p.updatedAt < :cursorAt OR (p.updatedAt = :cursorAt AND p.id < :cursorId)) " +
           "ORDER BY p.updatedAt DESC, p.id DESC")
    List<PageMetaProjection> findGithubMeta(
            @Param("updatedAfter") Instant updatedAfter,
            @Param("cursorAt") Instant cursorAt,
            @Param("cursorId") Long cursorId,
            Pageable pageable);

    /**
     * Feeds 分类查询 (connectorType = 1)
     */
    @Query("SELECT p.id AS id, p.title AS title, p.url AS url, p.author AS author, " +
           "p.authorScreenName AS authorScreenName, p.description AS description, " +
           "p.connectorType AS connectorType, p.connectorId AS connectorId, p.folderId AS folderId, " +
           "p.contentType AS contentType, p.librarySaveStatus AS librarySaveStatus, " +
           "p.starred AS starred, p.readLater AS readLater, p.savedAt AS savedAt, " +
           "p.updatedAt AS updatedAt, p.createdAt AS createdAt, p.lastReadAt AS lastReadAt, " +
           "p.archivedAt AS archivedAt, p.thumbUrl AS thumbUrl, p.highlightCount AS highlightCount, " +
           "p.pageJsonProperties AS pageJsonProperties " +
           "FROM Page p WHERE p.connectorType = 1 " +
           "AND (:updatedAfter IS NULL OR p.updatedAt > :updatedAfter) " +
           "AND (:cursorAt IS NULL OR p.updatedAt < :cursorAt OR (p.updatedAt = :cursorAt AND p.id < :cursorId)) " +
           "ORDER BY p.updatedAt DESC, p.id DESC")
    List<PageMetaProjection> findFeedsMeta(
            @Param("updatedAfter") Instant updatedAfter,
            @Param("cursorAt") Instant cursorAt,
            @Param("cursorId") Long cursorId,
            Pageable pageable);

    /**
     * RecentlyRead 分类查询 (lastReadAt IS NOT NULL)
     */
    @Query("SELECT p.id AS id, p.title AS title, p.url AS url, p.author AS author, " +
           "p.authorScreenName AS authorScreenName, p.description AS description, " +
           "p.connectorType AS connectorType, p.connectorId AS connectorId, p.folderId AS folderId, " +
           "p.contentType AS contentType, p.librarySaveStatus AS librarySaveStatus, " +
           "p.starred AS starred, p.readLater AS readLater, p.savedAt AS savedAt, " +
           "p.updatedAt AS updatedAt, p.createdAt AS createdAt, p.lastReadAt AS lastReadAt, " +
           "p.archivedAt AS archivedAt, p.thumbUrl AS thumbUrl, p.highlightCount AS highlightCount, " +
           "p.pageJsonProperties AS pageJsonProperties " +
           "FROM Page p WHERE p.lastReadAt IS NOT NULL " +
           "AND (:readAfter IS NULL OR p.lastReadAt > :readAfter) " +
           "AND (:cursorAt IS NULL OR p.lastReadAt < :cursorAt OR (p.lastReadAt = :cursorAt AND p.id < :cursorId)) " +
           "ORDER BY p.lastReadAt DESC, p.id DESC")
    List<PageMetaProjection> findRecentlyReadMeta(
            @Param("readAfter") Instant readAfter,
            @Param("cursorAt") Instant cursorAt,
            @Param("cursorId") Long cursorId,
            Pageable pageable);

    /**
     * Highlights 分类查询 (highlightCount > 0)
     */
    @Query("SELECT p.id AS id, p.title AS title, p.url AS url, p.author AS author, " +
           "p.authorScreenName AS authorScreenName, p.description AS description, " +
           "p.connectorType AS connectorType, p.connectorId AS connectorId, p.folderId AS folderId, " +
           "p.contentType AS contentType, p.librarySaveStatus AS librarySaveStatus, " +
           "p.starred AS starred, p.readLater AS readLater, p.savedAt AS savedAt, " +
           "p.updatedAt AS updatedAt, p.createdAt AS createdAt, p.lastReadAt AS lastReadAt, " +
           "p.archivedAt AS archivedAt, p.thumbUrl AS thumbUrl, p.highlightCount AS highlightCount, " +
           "p.pageJsonProperties AS pageJsonProperties " +
           "FROM Page p WHERE p.highlightCount > 0 " +
           "AND (:updatedAfter IS NULL OR p.updatedAt > :updatedAfter) " +
           "AND (:cursorAt IS NULL OR p.updatedAt < :cursorAt OR (p.updatedAt = :cursorAt AND p.id < :cursorId)) " +
           "ORDER BY p.updatedAt DESC, p.id DESC")
    List<PageMetaProjection> findHighlightsMeta(
            @Param("updatedAfter") Instant updatedAfter,
            @Param("cursorAt") Instant cursorAt,
            @Param("cursorId") Long cursorId,
            Pageable pageable);

    Optional<Page> findTop1ByUrl(String url);

    @Query("select p from Page p where p.url = :url and (p.contentType is null or p.contentType <> :excludedContentType)")
    List<Page> findByUrlExcludingContentType(@Param("url") String url, @Param("excludedContentType") Integer excludedContentType, Pageable pageable);

    Optional<Page> findTop1ByPageUniqueId(String pageUniqueId);
    
    Optional<Page> findTop1ByUrlWithoutHash(String urlWithoutHash);

    @Query("select p from Page p where p.urlWithoutHash = :urlWithoutHash and (p.contentType is null or p.contentType <> :excludedContentType)")
    List<Page> findByUrlWithoutHashExcludingContentType(@Param("urlWithoutHash") String urlWithoutHash, @Param("excludedContentType") Integer excludedContentType, Pageable pageable);

    int countByConnectorIdAndMarkRead(Integer connectorId, Boolean markRead);

    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Page p SET p.markRead = :markRead WHERE p.markRead <> :markRead and p.id in :ids")
    int updateMarkReadByIds(List<Long> ids, boolean markRead);

    @Query("SELECT distinct p.connectorId from Page p WHERE p.id in :ids")
    List<Integer> getConnectorIdsByPageIds(List<Long> ids);
    
    @Query("SELECT p.id from Page p WHERE p.updatedAt<:updateBefore and (p.connectorId = 0 or p.connectorId is null) and (p.librarySaveStatus = 0 or p.librarySaveStatus is null) order by p.id")
    List<Long> getColdDataPageIds(Instant updateBefore, Pageable pageable);

    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Page p SET p.markRead = :markRead WHERE p.markRead <> :markRead and p.connectorId = :connectorId")
    int updateMarkReadByConnectorId(Integer connectorId, boolean markRead);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query("UPDATE Page p SET p.markRead = :markRead WHERE p.markRead <> :markRead and p.folderId = :folderId")
    int updateMarkReadByFolderId(Integer folderId, boolean markRead);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query("UPDATE Page p SET p.markRead = :markRead WHERE p.markRead <> :markRead and p.connectorType = :connectorType")
    int updateMarkReadByConnectorType(Integer connectorType, boolean markRead);

    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Page p SET p.folderId = :folderId WHERE p.connectorId = :connectorId")
    void updateFolderIdByConnectorId(Integer connectorId, Integer folderId);

    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Page p SET p.folderId = null, p.connectorId = null, p.connectorType = null WHERE p.connectorId = :connectorId")
    void deleteConnectorId(Integer connectorId);
}