package com.huntly.server.repository;

import com.huntly.server.domain.entity.ArticleShortcut;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for ArticleShortcut entity
 */
@Repository
public interface ArticleShortcutRepository extends JpaRepository<ArticleShortcut, Integer>, JpaSpecificationExecutor<ArticleShortcut> {
    
    /**
     * Find a shortcut by its name
     * @param name the shortcut name
     * @return the shortcut, if found
     */
    Optional<ArticleShortcut> findByName(String name);
    
    /**
     * Find all shortcuts with the given name
     * @param name the shortcut name
     * @return list of shortcuts with the given name
     */
    List<ArticleShortcut> findAllByName(String name);
    
    /**
     * Find all enabled shortcuts
     * @return list of enabled shortcuts
     */
    List<ArticleShortcut> findByEnabledTrueOrderBySortOrderAsc();
    
    /**
     * Find all shortcuts ordered by sort order
     * @return list of all shortcuts
     */
    List<ArticleShortcut> findAllByOrderBySortOrderAsc();
} 