package com.huntly.server.domain.entity;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;

import javax.persistence.*;
import java.io.Serializable;
import java.time.Instant;

/**
 * @author lcomplete
 */
@Data
@Entity
@Table(name = "global_setting")
public class GlobalSetting implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "proxy_host")
    private String proxyHost;

    @Column(name = "proxy_port")
    private Integer proxyPort;

    @Column(name = "is_enable_proxy")
    private Boolean enableProxy;

    @Column(name = "cold_data_keep_days")
    private Integer coldDataKeepDays;

    @Column(name = "open_api_key")
    private String openApiKey;

    @Column(name = "open_api_base_url")
    private String openApiBaseUrl;

    @Column(name = "open_api_model")
    private String openApiModel;

    @Column(name = "article_summary_prompt", columnDefinition = "TEXT")
    private String articleSummaryPrompt;

    @Column(name = "auto_save_site_blacklists")
    private String autoSaveSiteBlacklists;

    @Column(name = "mark_read_on_scroll")
    private Boolean markReadOnScroll;

    @Column(name = "mcp_token")
    private String mcpToken;

    @Column(name = "auto_save_tweet_min_likes")
    private Integer autoSaveTweetMinLikes;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Transient
    private Boolean changedOpenApiKey;
}
