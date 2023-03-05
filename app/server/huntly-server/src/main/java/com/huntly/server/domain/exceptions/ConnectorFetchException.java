package com.huntly.server.domain.exceptions;

import com.huntly.common.exceptions.BaseException;

/**
 * @author lcomplete
 */
public class ConnectorFetchException extends BaseException {

    public ConnectorFetchException() {
        super();
    }

    public ConnectorFetchException(String msg) {
        super(msg);
    }

    public ConnectorFetchException(Throwable throwable) {
        super(throwable);
    }

    public ConnectorFetchException(String msg, Throwable throwable) {
        super(msg, throwable);
    }

    public ConnectorFetchException(int status, String msg) {
        super(status, msg);
    }

    public ConnectorFetchException(int status, Throwable throwable) {
        super(status, throwable);
    }

    public ConnectorFetchException(int status, String msg, Throwable throwable) {
        super(status, msg, throwable);
    }
}
