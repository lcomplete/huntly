package com.huntly.server.service;

import com.huntly.common.exceptions.DuplicateRecordException;
import com.huntly.server.domain.entity.Collection;
import com.huntly.server.domain.entity.CollectionGroup;
import com.huntly.server.domain.vo.CollectionGroupVO;
import com.huntly.server.domain.vo.CollectionTreeVO;
import com.huntly.server.domain.vo.CollectionVO;
import com.huntly.server.repository.CollectionGroupRepository;
import com.huntly.server.repository.CollectionRepository;
import com.huntly.server.repository.PageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for managing collections and collection groups.
 */
@Service
public class CollectionService {

    private final CollectionRepository collectionRepository;
    private final CollectionGroupRepository collectionGroupRepository;
    private final PageRepository pageRepository;

    public CollectionService(CollectionRepository collectionRepository,
            CollectionGroupRepository collectionGroupRepository,
            PageRepository pageRepository) {
        this.collectionRepository = collectionRepository;
        this.collectionGroupRepository = collectionGroupRepository;
        this.pageRepository = pageRepository;
    }

    /**
     * Get the full collections tree with groups, collections, and page counts.
     */
    public CollectionTreeVO getTree() {
        return buildTree(true);
    }

    /**
     * Get the collections tree structure without page counts (for export, etc.).
     */
    public CollectionTreeVO getTreeWithoutCounts() {
        return buildTree(false);
    }

    /**
     * Build the collections tree, optionally including page counts.
     */
    private CollectionTreeVO buildTree(boolean includeCounts) {
        CollectionTreeVO tree = new CollectionTreeVO();

        if (includeCounts) {
            Long unsortedCount = collectionRepository.countUnsortedPages();
            tree.setUnsortedCount(unsortedCount != null ? unsortedCount : 0L);
        }

        // Get all groups
        List<CollectionGroup> groups = collectionGroupRepository.findAllByOrderByDisplaySequenceAsc();

        // Get all collections
        List<Collection> allCollections = collectionRepository.findAllOrderedForTree();

        // Get page counts per collection (only if needed)
        Map<Long, Long> pageCountMap = Collections.emptyMap();
        if (includeCounts) {
            pageCountMap = new HashMap<>();
            List<Object[]> pageCounts = collectionRepository.countPagesPerCollection();
            for (Object[] row : pageCounts) {
                Long collectionId = (Long) row[0];
                Long count = (Long) row[1];
                pageCountMap.put(collectionId, count);
            }
        }

        // Build tree for each group
        for (CollectionGroup group : groups) {
            CollectionGroupVO groupVO = new CollectionGroupVO();
            groupVO.setId(group.getId());
            groupVO.setName(group.getName());
            groupVO.setIcon(group.getIcon());
            groupVO.setColor(group.getColor());
            groupVO.setDisplaySequence(group.getDisplaySequence());

            // Get collections for this group
            List<Collection> groupCollections = allCollections.stream()
                    .filter(c -> Objects.equals(c.getGroupId(), group.getId()))
                    .collect(Collectors.toList());

            // Build nested tree
            List<CollectionVO> rootCollections = buildCollectionTree(groupCollections, pageCountMap);
            groupVO.setCollections(rootCollections);

            tree.getGroups().add(groupVO);
        }

        return tree;
    }

    /**
     * Build a nested collection tree from flat list.
     */
    private List<CollectionVO> buildCollectionTree(List<Collection> collections, Map<Long, Long> pageCountMap) {
        Map<Long, CollectionVO> voMap = new HashMap<>();
        List<CollectionVO> roots = new ArrayList<>();

        // Create VOs
        for (Collection c : collections) {
            CollectionVO vo = new CollectionVO();
            vo.setId(c.getId());
            vo.setGroupId(c.getGroupId());
            vo.setParentId(c.getParentId());
            vo.setName(c.getName());
            vo.setIcon(c.getIcon());
            vo.setColor(c.getColor());
            vo.setDisplaySequence(c.getDisplaySequence());
            vo.setPageCount(pageCountMap.getOrDefault(c.getId(), 0L));
            voMap.put(c.getId(), vo);
        }

        // Build hierarchy
        for (Collection c : collections) {
            CollectionVO vo = voMap.get(c.getId());
            if (c.getParentId() == null) {
                roots.add(vo);
            } else {
                CollectionVO parent = voMap.get(c.getParentId());
                if (parent != null) {
                    parent.getChildren().add(vo);
                } else {
                    // Orphan - treat as root
                    roots.add(vo);
                }
            }
        }

        // Sort by displaySequence
        roots.sort(Comparator.comparingInt(v -> v.getDisplaySequence() != null ? v.getDisplaySequence() : 0));
        for (CollectionVO vo : voMap.values()) {
            vo.getChildren()
                    .sort(Comparator.comparingInt(v -> v.getDisplaySequence() != null ? v.getDisplaySequence() : 0));
        }

        return roots;
    }

    /**
     * Create a new collection.
     */
    @Transactional
    public Collection createCollection(Collection collection) {
        if (collection.getDisplaySequence() == null) {
            // Get max sequence for this parent
            List<Collection> siblings;
            if (collection.getParentId() == null) {
                siblings = collectionRepository
                        .findByParentIdIsNullAndGroupIdOrderByDisplaySequenceAsc(collection.getGroupId());
            } else {
                siblings = collectionRepository.findByParentIdOrderByDisplaySequenceAsc(collection.getParentId());
            }
            int maxSeq = siblings.stream()
                    .mapToInt(c -> c.getDisplaySequence() != null ? c.getDisplaySequence() : 0)
                    .max().orElse(0);
            collection.setDisplaySequence(maxSeq + 1);
        }
        return collectionRepository.save(collection);
    }

    /**
     * Update an existing collection.
     */
    @Transactional
    public Collection updateCollection(Long id, Collection updates) {
        Collection existing = collectionRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Collection not found: " + id));

        if (updates.getName() != null) {
            existing.setName(updates.getName());
        }
        if (updates.getIcon() != null) {
            existing.setIcon(updates.getIcon());
        }
        if (updates.getColor() != null) {
            existing.setColor(updates.getColor());
        }
        if (updates.getParentId() != null) {
            existing.setParentId(updates.getParentId());
        }
        if (updates.getGroupId() != null) {
            existing.setGroupId(updates.getGroupId());
        }

        return collectionRepository.save(existing);
    }

    /**
     * Delete a collection. Optionally delete all pages in it or move them to
     * Unsorted.
     */
    @Transactional
    public void deleteCollection(Long id, boolean deletePages) {
        Collection collection = collectionRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Collection not found: " + id));

        // Check for children
        List<Collection> children = collectionRepository.findByParentId(id);
        if (!children.isEmpty()) {
            // Recursively delete children first
            for (Collection child : children) {
                deleteCollection(child.getId(), deletePages);
            }
        }

        // Handle pages
        if (deletePages) {
            pageRepository.deleteByCollectionId(id);
        } else {
            pageRepository.setCollectionIdToNull(id);
        }

        // Delete the collection
        collectionRepository.delete(collection);
    }

    /**
     * Get page count for a collection.
     */
    public long getPageCount(Long collectionId) {
        return pageRepository.countByCollectionId(collectionId);
    }

    /**
     * Get a collection by ID.
     */
    public Collection getById(Long id) {
        return collectionRepository.findById(id).orElse(null);
    }

    /**
     * Reorder collections.
     */
    @Transactional
    public void reorderCollections(List<Long> collectionIds, Long newParentId, Long newGroupId) {
        for (int i = 0; i < collectionIds.size(); i++) {
            Collection collection = collectionRepository.findById(collectionIds.get(i)).orElse(null);
            if (collection != null) {
                collection.setDisplaySequence(i + 1);
                if (newParentId != null) {
                    collection.setParentId(newParentId);
                }
                if (newGroupId != null) {
                    collection.setGroupId(newGroupId);
                }
                collectionRepository.save(collection);
            }
        }
    }

    // ========== Collection Group Methods ==========

    /**
     * Get all groups.
     */
    public List<CollectionGroup> getAllGroups() {
        return collectionGroupRepository.findAllByOrderByDisplaySequenceAsc();
    }

    /**
     * Create a new group.
     */
    @Transactional
    public CollectionGroup createGroup(CollectionGroup group) {
        // Check for duplicate name
        if (collectionGroupRepository.existsByName(group.getName())) {
            throw new DuplicateRecordException("Collection group with name '" + group.getName() + "' already exists");
        }

        if (group.getDisplaySequence() == null) {
            List<CollectionGroup> all = collectionGroupRepository.findAllByOrderByDisplaySequenceAsc();
            int maxSeq = all.stream()
                    .mapToInt(g -> g.getDisplaySequence() != null ? g.getDisplaySequence() : 0)
                    .max().orElse(0);
            group.setDisplaySequence(maxSeq + 1);
        }
        return collectionGroupRepository.save(group);
    }

    /**
     * Update a group.
     */
    @Transactional
    public CollectionGroup updateGroup(Long id, CollectionGroup updates) {
        CollectionGroup existing = collectionGroupRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Collection group not found: " + id));

        if (updates.getName() != null) {
            // Check for duplicate name (excluding current group)
            if (collectionGroupRepository.existsByNameAndIdNot(updates.getName(), id)) {
                throw new DuplicateRecordException(
                        "Collection group with name '" + updates.getName() + "' already exists");
            }
            existing.setName(updates.getName());
        }
        if (updates.getIcon() != null) {
            existing.setIcon(updates.getIcon());
        }
        if (updates.getColor() != null) {
            existing.setColor(updates.getColor());
        }

        return collectionGroupRepository.save(existing);
    }

    /**
     * Delete a group (only if it has no collections).
     */
    @Transactional
    public void deleteGroup(Long id) {
        CollectionGroup group = collectionGroupRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Collection group not found: " + id));

        if (collectionRepository.existsByGroupId(id)) {
            throw new IllegalStateException(
                    "Cannot delete group with existing collections. Delete or move collections first.");
        }

        collectionGroupRepository.delete(group);
    }

    /**
     * Reorder groups.
     */
    @Transactional
    public void reorderGroups(List<Long> groupIds) {
        for (int i = 0; i < groupIds.size(); i++) {
            CollectionGroup group = collectionGroupRepository.findById(groupIds.get(i)).orElse(null);
            if (group != null) {
                group.setDisplaySequence(i + 1);
                collectionGroupRepository.save(group);
            }
        }
    }
}
