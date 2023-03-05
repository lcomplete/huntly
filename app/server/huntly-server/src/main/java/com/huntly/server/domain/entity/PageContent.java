package com.huntly.server.domain.entity;

import lombok.Data;

import javax.persistence.*;
import java.io.Serializable;

/**
 * @author lcomplete
 */
@Data
@Entity
@Table(name = "page_content")
public class PageContent implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "content")
    private String content;
}
