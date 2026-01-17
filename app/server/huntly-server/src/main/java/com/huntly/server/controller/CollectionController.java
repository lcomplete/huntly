package com.huntly.server.controller;

import com.huntly.server.domain.entity.Collection;
import com.huntly.server.domain.entity.CollectionGroup;
import com.huntly.server.domain.vo.CollectionTreeVO;
import com.huntly.server.service.CollectionService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Controller for managing collections and collection groups.
 */
@Validated
@RestController
@RequestMapping("/api")
public class CollectionController {

    private final CollectionService collectionService;

    public CollectionController(CollectionService collectionService) {
        this.collectionService = collectionService;
    }

    // ========== Collection Tree ==========

    @GetMapping("/collections/tree")
    public CollectionTreeVO getTree() {
        return collectionService.getTree();
    }

    // ========== Collections ==========

    @PostMapping("/collections")
    public Collection createCollection(@Valid @RequestBody Collection collection) {
        return collectionService.createCollection(collection);
    }

    @PutMapping("/collections/{id}")
    public Collection updateCollection(@PathVariable("id") Long id, @Valid @RequestBody Collection collection) {
        return collectionService.updateCollection(id, collection);
    }

    @DeleteMapping("/collections/{id}")
    public void deleteCollection(@PathVariable("id") Long id,
            @RequestBody(required = false) Map<String, Boolean> body) {
        boolean deletePages = body != null && Boolean.TRUE.equals(body.get("deletePages"));
        collectionService.deleteCollection(id, deletePages);
    }

    @GetMapping("/collections/{id}")
    public Collection getCollection(@PathVariable("id") Long id) {
        return collectionService.getById(id);
    }

    @GetMapping("/collections/{id}/page-count")
    public Map<String, Long> getPageCount(@PathVariable("id") Long id) {
        return Map.of("count", collectionService.getPageCount(id));
    }

    @PostMapping("/collections/reorder")
    public void reorderCollections(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Long> ids = ((List<Number>) body.get("ids")).stream().map(Number::longValue).collect(Collectors.toList());
        Long newParentId = body.get("newParentId") != null ? ((Number) body.get("newParentId")).longValue() : null;
        Long newGroupId = body.get("newGroupId") != null ? ((Number) body.get("newGroupId")).longValue() : null;
        collectionService.reorderCollections(ids, newParentId, newGroupId);
    }

    // ========== Collection Groups ==========

    @GetMapping("/collection-groups")
    public List<CollectionGroup> getAllGroups() {
        return collectionService.getAllGroups();
    }

    @PostMapping("/collection-groups")
    public CollectionGroup createGroup(@Valid @RequestBody CollectionGroup group) {
        return collectionService.createGroup(group);
    }

    @PutMapping("/collection-groups/{id}")
    public CollectionGroup updateGroup(@PathVariable("id") Long id, @Valid @RequestBody CollectionGroup group) {
        return collectionService.updateGroup(id, group);
    }

    @DeleteMapping("/collection-groups/{id}")
    public void deleteGroup(@PathVariable("id") Long id) {
        collectionService.deleteGroup(id);
    }

    @PostMapping("/collection-groups/reorder")
    public void reorderGroups(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Long> ids = ((List<Number>) body.get("ids")).stream().map(Number::longValue).collect(Collectors.toList());
        collectionService.reorderGroups(ids);
    }
}
