package com.huntly.server.repository;

import com.huntly.server.domain.entity.Collection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CollectionRepository extends JpaRepository<Collection, Long> {

    List<Collection> findByGroupIdOrderByDisplaySequenceAsc(Long groupId);

    List<Collection> findByParentIdOrderByDisplaySequenceAsc(Long parentId);

    List<Collection> findByParentIdIsNullAndGroupIdOrderByDisplaySequenceAsc(Long groupId);

    /**
     * Find all collections ordered by group and display sequence for building the
     * tree.
     */
    @Query("SELECT c FROM Collection c ORDER BY c.groupId, c.displaySequence")
    List<Collection> findAllOrderedForTree();

    /**
     * Check if a group has any collections.
     */
    boolean existsByGroupId(Long groupId);

    /**
     * Find all child collections of a parent (for recursive deletion checks).
     */
    List<Collection> findByParentId(Long parentId);

    /**
     * Get page counts per collection.
     */
    @Query("SELECT p.collectionId, COUNT(p) FROM Page p WHERE p.collectionId IS NOT NULL GROUP BY p.collectionId")
    List<Object[]> countPagesPerCollection();

    /**
     * Count pages that are unsorted (collectionId is null) and in library.
     */
    @Query("SELECT COUNT(p) FROM Page p WHERE p.collectionId IS NULL AND p.librarySaveStatus > 0")
    Long countUnsortedPages();
}
