package com.huntly.server.controller;

import com.huntly.server.domain.entity.ArticleShortcut;
import com.huntly.server.service.ArticleShortcutService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Controller for article shortcuts API endpoints
 */
@RestController
@RequestMapping("/api/article-shortcuts")
public class ArticleShortcutController {
    
    private final ArticleShortcutService shortcutService;
    
    public ArticleShortcutController(ArticleShortcutService shortcutService) {
        this.shortcutService = shortcutService;
    }
    
    /**
     * Get all shortcuts
     * @return list of all shortcuts
     */
    @GetMapping
    public List<ArticleShortcut> getAllShortcuts() {
        return shortcutService.getAllShortcuts();
    }
    
    /**
     * Get enabled shortcuts
     * @return list of enabled shortcuts
     */
    @GetMapping("/enabled")
    public List<ArticleShortcut> getEnabledShortcuts() {
        return shortcutService.getEnabledShortcuts();
    }
    
    /**
     * Get a shortcut by ID
     * @param id the shortcut ID
     * @return the shortcut
     */
    @GetMapping("/{id}")
    public ArticleShortcut getShortcutById(@PathVariable Integer id) {
        return shortcutService.getShortcutById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shortcut not found"));
    }
    
    /**
     * Create a new shortcut
     * @param shortcut the shortcut to create
     * @return the created shortcut
     */
    @PostMapping
    public ResponseEntity<?> createShortcut(@RequestBody ArticleShortcut shortcut) {
        try {
            ArticleShortcut savedShortcut = shortcutService.saveShortcut(shortcut);
            return ResponseEntity.ok(savedShortcut);
        } catch (IllegalArgumentException e) {
            return ResponseEntity
                    .status(HttpStatus.CONFLICT)
                    .body(e.getMessage());
        }
    }
    
    /**
     * Update a shortcut
     * @param id the shortcut ID
     * @param shortcut the updated shortcut data
     * @return the updated shortcut
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateShortcut(@PathVariable Integer id, @RequestBody ArticleShortcut shortcut) {
        if (!shortcutService.getShortcutById(id).isPresent()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Shortcut not found");
        }
        
        try {
            shortcut.setId(id);
            ArticleShortcut updatedShortcut = shortcutService.saveShortcut(shortcut);
            return ResponseEntity.ok(updatedShortcut);
        } catch (IllegalArgumentException e) {
            return ResponseEntity
                    .status(HttpStatus.CONFLICT)
                    .body(e.getMessage());
        }
    }
    
    /**
     * Delete a shortcut
     * @param id the shortcut ID
     */
    @DeleteMapping("/{id}")
    public void deleteShortcut(@PathVariable Integer id) {
        if (!shortcutService.getShortcutById(id).isPresent()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Shortcut not found");
        }
        shortcutService.deleteShortcut(id);
    }
    
    /**
     * Save multiple shortcuts
     * @param shortcuts the shortcuts to save
     * @return the saved shortcuts
     */
    @PostMapping("/batch")
    public ResponseEntity<?> saveShortcuts(@RequestBody List<ArticleShortcut> shortcuts) {
        try {
            List<ArticleShortcut> savedShortcuts = shortcutService.saveShortcuts(shortcuts);
            return ResponseEntity.ok(savedShortcuts);
        } catch (IllegalArgumentException e) {
            return ResponseEntity
                    .status(HttpStatus.CONFLICT)
                    .body(e.getMessage());
        }
    }
    
    /**
     * Get importable default shortcuts
     * @return list of default shortcuts that can be imported
     */
    @GetMapping("/importable-defaults")
    public List<ArticleShortcut> getImportableDefaultShortcuts() {
        return shortcutService.getImportableDefaultShortcuts();
    }
    
    /**
     * Import default shortcuts
     * @return the imported shortcuts
     */
    @PostMapping("/import-defaults")
    public List<ArticleShortcut> importDefaultShortcuts() {
        return shortcutService.importDefaultShortcuts();
    }
    
    /**
     * Import selected shortcuts by name
     * @param shortcutNames list of shortcut names to import
     * @return the imported shortcuts
     */
    @PostMapping("/import-selected")
    public List<ArticleShortcut> importSelectedShortcuts(@RequestBody List<String> shortcutNames) {
        return shortcutService.importSelectedShortcuts(shortcutNames);
    }
} 