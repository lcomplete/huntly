package com.huntly.server.domain.entity;

import lombok.Data;

import javax.persistence.*;
import java.io.Serializable;

@Data
@Entity
@Table(name = "source")
public class Source implements Serializable {

    private static final long serialVersionUID = -5460676068284121149L;

    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "site_name")
    private String siteName;

    @Column(name = "home_url")
    private String homeUrl;

    @Column(name = "subscribe_url")
    private String subscribeUrl;

    @Column(name = "domain")
    private String domain;

    @Column(name = "favicon_url")
    private String faviconUrl;

}
