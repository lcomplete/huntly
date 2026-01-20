package com.huntly.server.repository;

import com.huntly.jpa.repository.JpaRepositoryWithLimit;
import com.huntly.jpa.repository.JpaSpecificationExecutorWithProjection;
import com.huntly.server.domain.entity.Page;
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
public interface PageRepository extends JpaRepository<Page, Long>, JpaSpecificationExecutor<Page>,
        JpaSpecificationExecutorWithProjection<Page>, JpaRepositoryWithLimit<Page, Long> {

    Optional<Page> findTop1ByUrl(String url);

    @Query("select p from Page p where p.url = :url and (p.contentType is null or p.contentType <> :excludedContentType)")
    List<Page> findByUrlExcludingContentType(@Param("url") String url,
            @Param("excludedContentType") Integer excludedContentType, Pageable pageable);

    Optional<Page> findTop1ByPageUniqueId(String pageUniqueId);

    Optional<Page> findTop1ByUrlWithoutHash(String urlWithoutHash);

    @Query("select p from Page p where p.urlWithoutHash = :urlWithoutHash and (p.contentType is null or p.contentType <> :excludedContentType)")
    List<Page> findByUrlWithoutHashExcludingContentType(@Param("urlWithoutHash") String urlWithoutHash,
            @Param("excludedContentType") Integer excludedContentType, Pageable pageable);

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

    @Query("SELECT COUNT(p) FROM Page p WHERE p.readLater = true AND p.librarySaveStatus = :librarySaveStatus")
    long countReadLaterByLibrarySaveStatus(@Param("librarySaveStatus") Integer librarySaveStatus);

    /**
     * Set collectionId to null for all pages in a collection (move to Unsorted).
     */
    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Page p SET p.collectionId = null WHERE p.collectionId = :collectionId")
    int setCollectionIdToNull(@Param("collectionId") Long collectionId);

    /**
     * Delete all pages in a collection.
     */
    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Page p WHERE p.collectionId = :collectionId")
    int deleteByCollectionId(@Param("collectionId") Long collectionId);

    /**
     * Count pages in a specific collection.
     * Only count pages that are in library (librarySaveStatus > 0, i.e., SAVED or ARCHIVED).
     */
    @Query("SELECT COUNT(p) FROM Page p WHERE p.collectionId = :collectionId AND p.librarySaveStatus > 0")
    long countByCollectionId(@Param("collectionId") Long collectionId);

    /**
     * Find pages by collection ID.
     */
    List<Page> findByCollectionId(Long collectionId);

    /**
     * Find pages by collection ID with pagination, ordered by savedAt desc.
     */
    List<Page> findByCollectionIdAndLibrarySaveStatusGreaterThanOrderBySavedAtDesc(Long collectionId,
            Integer librarySaveStatus, Pageable pageable);

    /**
     * Find unsorted pages (collectionId is null) in library with pagination.
     */
    @Query("SELECT p FROM Page p WHERE p.collectionId IS NULL AND p.librarySaveStatus > 0 ORDER BY p.savedAt DESC")
    List<Page> findUnsortedLibraryPages(Pageable pageable);

    /**
     * Batch update collection only, keeping original collectedAt.
     * Used for pages already in library.
     */
    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Page p SET p.collectionId = :collectionId WHERE p.id IN :ids")
    int batchUpdateCollection(@Param("ids") List<Long> ids, @Param("collectionId") Long collectionId);

    /**
     * Batch update collection and set collectedAt to connectedAt (publish time).
     * Fallback to original collectedAt if connectedAt is null.
     * Used for pages already in library.
     */
    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Page p SET p.collectionId = :collectionId, " +
           "p.collectedAt = COALESCE(p.connectedAt, p.collectedAt) " +
           "WHERE p.id IN :ids")
    int batchUpdateCollectionWithPublishTime(@Param("ids") List<Long> ids, @Param("collectionId") Long collectionId);
}