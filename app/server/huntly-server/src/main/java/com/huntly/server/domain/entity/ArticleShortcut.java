package com.huntly.server.domain.entity;

import lombok.Data;

import javax.persistence.*;
import java.io.Serializable;
import java.time.Instant;

/**
 * Entity for article operation shortcuts
 */
@Data
@Entity
@Table(name = "article_shortcut")
public class ArticleShortcut implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    /**
     * Shortcut name, must be unique
     */
    @Column(name = "name", nullable = false, unique = true)
    private String name;

    /**
     * Shortcut content (prompt)
     */
    @Column(name = "content", columnDefinition = "TEXT", nullable = false)
    private String content;
    
    /**
     * Description of what the shortcut does
     */
    @Column(name = "description")
    private String description;
    
    /**
     * Whether this shortcut is enabled
     */
    @Column(name = "enabled", nullable = false)
    private Boolean enabled = true;
    
    /**
     * Sort order of the shortcut
     */
    @Column(name = "sort_order")
    private Integer sortOrder;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
} 