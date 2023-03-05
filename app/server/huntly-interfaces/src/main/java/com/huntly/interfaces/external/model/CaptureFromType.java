package com.huntly.interfaces.external.model;

/**
 * @author lcomplete
 */

public enum CaptureFromType {
    BROWSER(0),
    CONNECTOR(1),
    FEED(2);
    
    private final int code;
    
    public int getCode(){
        return code;
    }

    CaptureFromType(int code) {
        this.code = code;
    }
}
