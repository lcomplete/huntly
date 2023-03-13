package com.huntly.server.domain.entity;

import lombok.Data;
import org.hibernate.annotations.DynamicUpdate;

import javax.persistence.*;
import java.io.Serializable;
import java.time.Instant;

/**
 * @author lcomplete
 */
@Entity
@Data
@Table(name = "connector")
@DynamicUpdate
public class Connector implements Serializable {

    private static final long serialVersionUID = 5025656057499221740L;

    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @Column(name = "type")
    private Integer type;

    @Column(name = "name")
    private String name;

    @Column(name = "subscribe_url")
    private String subscribeUrl;
    
    @Column(name = "api_token")
    private String apiToken;

    @Column(name = "icon_url")
    private String iconUrl;

    @Column(name = "folder_id")
    private Integer folderId;

    @Column(name = "display_sequence")
    private Integer displaySequence;

    @Column(name = "fetch_interval_seconds")
    private Integer fetchIntervalSeconds;

    @Column(name = "fetch_page_size")
    private Integer fetchPageSize;

    @Column(name = "last_fetch_begin_at")
    private Instant lastFetchBeginAt;

    @Column(name = "last_fetch_end_at")
    private Instant lastFetchEndAt;

    @Column(name = "is_last_fetch_success")
    private Boolean lastFetchSuccess;

    @Column(name = "inbox_count")
    private Integer inboxCount;

    @Column(name = "crawl_full_content")
    private Boolean crawlFullContent;
    
    @Column(name = "is_enabled")
    private Boolean enabled;

    @Column(name = "created_at")
    private Instant createdAt;
}
