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

    @Column(name = "folder_id")
    private Integer folderId;

    @Column(name = "display_sequence")
    private Integer displaySequence;

    @Column(name = "site_name")
    private String siteName;

    @Column(name = "home_url")
    private String homeUrl;

    @Column(name = "subscribe_url")
    private String subscribeUrl;

    @Column(name = "is_subscribed")
    private Boolean subscribed;

    @Column(name = "crawl_type")
    private Integer crawlType;

    @Column(name = "crawl_interval")
    private Long crawlInterval;

    @Column(name = "unread_page_count")
    private Long unreadPageCount;

    @Column(name = "repeat_read_count")
    private Long repeatReadCount;

    @Column(name = "last_crawl_date")
    private String lastCrawlDate;

    @Column(name = "create_date")
    private String createDate;

    @Column(name = "subscribed_date")
    private String subscribedDate;

    @Column(name = "is_silent")
    private Boolean silent;

    @Column(name = "domain")
    private String domain;

    @Column(name = "favicon_url")
    private String faviconUrl;

}
