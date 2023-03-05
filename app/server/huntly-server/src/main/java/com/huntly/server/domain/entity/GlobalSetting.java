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

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
