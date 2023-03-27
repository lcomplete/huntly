package com.huntly.server.domain.entity;

import lombok.Data;

import javax.persistence.*;
import java.io.Serializable;
import java.time.Instant;

/**
 * @author lcomplete
 */
@Data
@Entity
@Table(name = "page_article_content")
public class PageArticleContent implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "page_id")
    private Long pageId;

    @Column(name = "content")
    private String content;
    
    @Column(name = "article_content_category")
    private Integer articleContentCategory;
    
    @Column(name = "updated_at")
    private Instant updatedAt;
}
