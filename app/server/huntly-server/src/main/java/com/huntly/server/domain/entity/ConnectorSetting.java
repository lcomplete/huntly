package com.huntly.server.domain.entity;

import lombok.Data;

import javax.persistence.*;
import java.io.Serializable;

/**
 * @author lcomplete
 */
@Entity
@Data
@Table(name = "connector_setting")
public class ConnectorSetting implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "connector_id")
    private Integer connectorId;

    @Column(name = "setting_key")
    private String settingKey;

    @Column(name = "setting_value")
    private String settingValue;

}
