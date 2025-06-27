package com.huntly.server.service;

import com.huntly.server.domain.constant.DefaultShortcuts;
import com.huntly.server.domain.entity.ArticleShortcut;
import com.huntly.server.repository.ArticleShortcutRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Service for managing article shortcuts
 */
@Slf4j
@Service
public class ArticleShortcutService {
    
    private final ArticleShortcutRepository shortcutRepository;
    private final DefaultShortcuts defaultShortcuts;
    
    public ArticleShortcutService(ArticleShortcutRepository shortcutRepository, DefaultShortcuts defaultShortcuts) {
        this.shortcutRepository = shortcutRepository;
        this.defaultShortcuts = defaultShortcuts;
    }
    
    /**
     * Initialize default shortcuts if none exist in the database
     */
    public void initializeDefaultShortcuts() {
        if (shortcutRepository.count() == 0) {
            log.info("No article shortcuts found. Initializing default shortcuts.");
            importDefaultShortcuts();
        }
    }
    
    /**
     * Get all shortcuts
     * @return list of all shortcuts ordered by sort order
     */
    public List<ArticleShortcut> getAllShortcuts() {
        return shortcutRepository.findAllByOrderBySortOrderAsc();
    }
    
    /**
     * Get all enabled shortcuts
     * @return list of enabled shortcuts
     */
    public List<ArticleShortcut> getEnabledShortcuts() {
        return shortcutRepository.findByEnabledTrueOrderBySortOrderAsc();
    }
    
    /**
     * Save a shortcut
     * @param shortcut the shortcut to save
     * @return the saved shortcut
     * @throws IllegalArgumentException if a shortcut with the same name already exists
     */
    public ArticleShortcut saveShortcut(ArticleShortcut shortcut) {
        // Check name uniqueness when creating a new shortcut or updating with a different name
        if (shortcut.getId() == null) {
            // New shortcut - check if name already exists
            Optional<ArticleShortcut> existingShortcut = shortcutRepository.findByName(shortcut.getName());
            if (existingShortcut.isPresent()) {
                throw new IllegalArgumentException("A shortcut with the name '" + shortcut.getName() + "' already exists");
            }
            shortcut.setCreatedAt(Instant.now());
        } else {
            // Existing shortcut - check if name is changed and conflicts
            Optional<ArticleShortcut> existingShortcut = shortcutRepository.findById(shortcut.getId());
            if (existingShortcut.isPresent()) {
                ArticleShortcut current = existingShortcut.get();
                // If name changed, check for conflicts
                if (!current.getName().equals(shortcut.getName())) {
                    Optional<ArticleShortcut> nameConflict = shortcutRepository.findByName(shortcut.getName());
                    if (nameConflict.isPresent() && !nameConflict.get().getId().equals(shortcut.getId())) {
                        throw new IllegalArgumentException("A shortcut with the name '" + shortcut.getName() + "' already exists");
                    }
                }
            }
        }
        
        shortcut.setUpdatedAt(Instant.now());
        
        // Set default values if not specified
        if (shortcut.getEnabled() == null) {
            shortcut.setEnabled(true);
        }
        
        // Set sort order if not specified
        if (shortcut.getSortOrder() == null) {
            Integer maxSortOrder = shortcutRepository.findAll().stream()
                    .map(ArticleShortcut::getSortOrder)
                    .filter(order -> order != null)
                    .max(Integer::compareTo)
                    .orElse(0);
            shortcut.setSortOrder(maxSortOrder + 1);
        }
        
        return shortcutRepository.save(shortcut);
    }
    
    /**
     * Save a list of shortcuts
     * @param shortcuts the shortcuts to save
     * @return the saved shortcuts
     */
    public List<ArticleShortcut> saveShortcuts(List<ArticleShortcut> shortcuts) {
        List<ArticleShortcut> savedShortcuts = new ArrayList<>();
        for (ArticleShortcut shortcut : shortcuts) {
            savedShortcuts.add(saveShortcut(shortcut));
        }
        return savedShortcuts;
    }
    
    /**
     * Delete a shortcut by ID
     * @param id the shortcut ID
     */
    public void deleteShortcut(Integer id) {
        shortcutRepository.deleteById(id);
    }
    
    /**
     * Get a shortcut by ID
     * @param id the shortcut ID
     * @return the shortcut, if found
     */
    public Optional<ArticleShortcut> getShortcutById(Integer id) {
        return shortcutRepository.findById(id);
    }
    
    /**
     * Get a shortcut by name
     * @param name the shortcut name
     * @return the shortcut, if found
     */
    public Optional<ArticleShortcut> getShortcutByName(String name) {
        return shortcutRepository.findByName(name);
    }
    
    /**
     * Import default shortcuts
     * @return the imported shortcuts
     */
    public List<ArticleShortcut> importDefaultShortcuts() {
        List<ArticleShortcut> defaultShortcuts = this.defaultShortcuts.getDefaultShortcuts();
        List<ArticleShortcut> importedShortcuts = new ArrayList<>();
        
        for (ArticleShortcut shortcut : defaultShortcuts) {
            // Check if shortcuts with the same name already exist
            List<ArticleShortcut> existingShortcuts = shortcutRepository.findAllByName(shortcut.getName());
            if (!existingShortcuts.isEmpty()) {
                // Update the first existing shortcut with the same name
                ArticleShortcut updatedShortcut = existingShortcuts.get(0);
                updatedShortcut.setDescription(shortcut.getDescription());
                updatedShortcut.setContent(shortcut.getContent());
                updatedShortcut.setEnabled(shortcut.getEnabled());
                updatedShortcut.setUpdatedAt(Instant.now());
                log.info("Updating existing shortcut with name '{}' (found {} with same name)", 
                        shortcut.getName(), existingShortcuts.size());
                importedShortcuts.add(saveShortcut(updatedShortcut));
            } else {
                importedShortcuts.add(saveShortcut(shortcut));
            }
        }
        
        return importedShortcuts;
    }
    
    /**
     * Get the default shortcuts that are not already in the database
     * @return list of default shortcuts not in the database
     */
    public List<ArticleShortcut> getImportableDefaultShortcuts() {
        // Return all default shortcuts directly without checking the database
        return this.defaultShortcuts.getDefaultShortcuts();
    }
    
    /**
     * Import selected shortcuts by name
     * @param shortcutNames list of shortcut names to import
     * @return the imported shortcuts
     */
    public List<ArticleShortcut> importSelectedShortcuts(List<String> shortcutNames) {
        List<ArticleShortcut> defaultShortcuts = this.defaultShortcuts.getDefaultShortcuts();
        List<ArticleShortcut> importedShortcuts = new ArrayList<>();
        
        for (ArticleShortcut shortcut : defaultShortcuts) {
            // Only import shortcuts that are in the selected list
            if (shortcutNames.contains(shortcut.getName())) {
                // Check if shortcuts with the same name already exist
                List<ArticleShortcut> existingShortcuts = shortcutRepository.findAllByName(shortcut.getName());
                if (!existingShortcuts.isEmpty()) {
                    // Update the first existing shortcut with the same name
                    ArticleShortcut updatedShortcut = existingShortcuts.get(0);
                    updatedShortcut.setDescription(shortcut.getDescription());
                    updatedShortcut.setContent(shortcut.getContent());
                    updatedShortcut.setEnabled(shortcut.getEnabled());
                    updatedShortcut.setUpdatedAt(Instant.now());
                    log.info("Updating existing shortcut with name '{}' (found {} with same name)", 
                            shortcut.getName(), existingShortcuts.size());
                    importedShortcuts.add(saveShortcut(updatedShortcut));
                } else {
                    importedShortcuts.add(saveShortcut(shortcut));
                }
            }
        }
        
        return importedShortcuts;
    }
} 