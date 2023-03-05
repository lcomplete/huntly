package com.huntly.common.exceptions;

/**
 * @author lcomplete
 */
public class BaseException extends StatefulException {
    private static final long serialVersionUID = 1L;

    public BaseException() {
    }

    public BaseException(String msg) {
        super(msg);
    }

    public BaseException(Throwable throwable) {
        super(throwable);
    }

    public BaseException(String msg, Throwable throwable) {
        super(msg, throwable);
    }

    public BaseException(int status, String msg) {
        super(status, msg);
    }

    public BaseException(int status, Throwable throwable) {
        super(status, throwable);
    }

    public BaseException(int status, String msg, Throwable throwable) {
        super(status, msg, throwable);
    }
}
