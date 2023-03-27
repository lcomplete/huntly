package com.huntly.server.repository;

import com.huntly.jpa.repository.JpaRepositoryWithLimit;
import com.huntly.jpa.repository.JpaSpecificationExecutorWithProjection;
import com.huntly.server.domain.entity.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface PageRepository extends JpaRepository<Page, Long>, JpaSpecificationExecutor<Page>, JpaSpecificationExecutorWithProjection<Page>, JpaRepositoryWithLimit<Page, Long> {

    Optional<Page> findTop1ByUrl(String url);
    
    Optional<Page> findTop1ByPageUniqueId(String pageUniqueId);
    
    Optional<Page> findTop1ByUrlWithoutHash(String urlWithoutHash);

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