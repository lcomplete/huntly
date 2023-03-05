package com.huntly.server.domain.entity;

import lombok.Data;

import javax.persistence.*;
import java.io.Serializable;

/**
 * @author lcomplete
 */
@Data
@Entity
@Table(name="page_properties")
public class PageProperties implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "page_id")
    private Long pageId;

    @Column(name = "property_key")
    private String propertyKey;

    @Column(name = "property_value")
    private String propertyValue;
}
