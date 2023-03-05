package com.huntly.server.connector;

import com.huntly.common.enums.BaseEnum;

/**
 * @author lcomplete
 */

public enum ConnectorType implements BaseEnum {
    RSS(1),
    GITHUB(2);
    
    private final Integer code;

    public Integer getCode() {
        return code;
    }

    @Override
    public String getDesc() {
        return null;
    }

    ConnectorType(Integer code) {
        this.code = code;
    }
}
