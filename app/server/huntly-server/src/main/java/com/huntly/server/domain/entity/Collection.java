package com.huntly.server.domain.entity;

import lombok.Data;

import javax.persistence.*;
import java.io.Serializable;
import java.time.Instant;

/**
 * A collection for organizing saved pages. Supports nested hierarchy via
 * parentId.
 */
@Data
@Entity
@Table(name = "collection", indexes = {
        @Index(name = "idx_collection_group_parent_seq", columnList = "group_id, parent_id, display_sequence"),
        @Index(name = "idx_collection_parent", columnList = "parent_id")
})
public class Collection implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    @Column(name = "parent_id")
    private Long parentId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "icon")
    private String icon;

    @Column(name = "color")
    private String color;

    @Column(name = "display_sequence")
    private Integer displaySequence;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
        if (displaySequence == null) {
            displaySequence = 0;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
