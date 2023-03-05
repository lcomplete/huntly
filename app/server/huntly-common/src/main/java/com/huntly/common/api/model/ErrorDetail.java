package com.huntly.common.api.model;


import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

/**
 * 错误详情
 * @author lcomplete
 */
@Getter
@Setter
public class ErrorDetail implements Serializable {

    private static final long serialVersionUID = 2616876803298549771L;

    private int code;

    private String message;

    private String type;
}
