package com.huntly.common.api.model;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

/**
 * 错误响应
 * @author lcomplete
 */
@Getter
@Setter
public class ErrorResponse implements Serializable {

    private static final long serialVersionUID = 706966450577903961L;

    private ErrorDetail error;

}
