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
@Table(name = "search_history")
public class SearchHistory implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "query")
    private String query;

    @Column(name = "options")
    private String options;

    @Column(name = "search_at")
    private Instant searchAt;
}
