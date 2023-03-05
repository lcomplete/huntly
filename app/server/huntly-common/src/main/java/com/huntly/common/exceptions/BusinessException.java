package com.huntly.common.exceptions;

/**
 * 业务层通用异常（一般在service中抛出，service中的异常继承该异常）
 * @author lcomplete
 */
public class BusinessException extends BaseException {
    private static final long serialVersionUID = 1L;

    public BusinessException() {
        super();
    }

    public BusinessException(String msg) {
        super(msg);
    }

    public BusinessException(Throwable throwable) {
        super(throwable);
    }

    public BusinessException(String msg, Throwable throwable) {
        super(msg, throwable);
    }

    public BusinessException(int status, String msg) {
        super(status, msg);
    }

    public BusinessException(int status, Throwable throwable) {
        super(status, throwable);
    }

    public BusinessException(int status, String msg, Throwable throwable) {
        super(status, msg, throwable);
    }
}
