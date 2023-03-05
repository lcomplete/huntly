package com.huntly.server.handler;

import com.huntly.common.api.ApiCode;
import com.huntly.common.api.model.ErrorDetail;
import com.huntly.common.api.model.ErrorMessageType;
import com.huntly.common.api.model.ErrorResponse;
import com.huntly.common.exceptions.*;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;

/**
 * 自定义错误处理器
 *
 * @author lcomplete
 */
@ControllerAdvice
@ResponseBody
@Slf4j
public class CustomExceptionHandler {

    @ExceptionHandler(value = Exception.class)
    public ResponseEntity<ErrorResponse> exceptionHandler(Exception exception) {
        return serverErrorResponse(ApiCode.SYSTEM_EXCEPTION, exception);
    }

    private ResponseEntity<ErrorResponse> serverErrorResponse(ApiCode apiCode, Exception exception) {
        String message = apiCode.getMessage();
        //服务端异常需要记录日志
        log.error(message, exception);
        //服务端异常使用api code中的message，避免敏感异常信息发送到客户端
        return new ResponseEntity<>(errorResponse(apiCode, ErrorMessageType.API_CODE, exception), HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private ResponseEntity<ErrorResponse> requestErrorResponse(ApiCode apiCode, Exception exception) {
        String message = apiCode.getMessage();
        ErrorMessageType errorMessageType = ErrorMessageType.API_CODE;
        //客户端请求错误只记录debug日志
        if (log.isDebugEnabled()) {
            log.debug(message, exception);
            //开启调试时，客户端异常使用异常中的message
            errorMessageType = ErrorMessageType.EXCEPTION;
        }
        return new ResponseEntity<>(errorResponse(apiCode, errorMessageType, exception), HttpStatus.BAD_REQUEST);
    }

    private ErrorResponse errorResponse(ApiCode code, ErrorMessageType messageType, Exception exception) {
        ErrorDetail errorDetail = new ErrorDetail();
        errorDetail.setCode(code.getCode());
        if (messageType.equals(ErrorMessageType.API_CODE) || StringUtils.isBlank(exception.getMessage())) {
            errorDetail.setMessage(code.getMessage());
        } else {
            errorDetail.setMessage(exception.getMessage());
        }
        errorDetail.setType(exception.getClass().getSimpleName());

        ErrorResponse errorResponse = new ErrorResponse();
        errorResponse.setError(errorDetail);
        return errorResponse;
    }

    @ExceptionHandler(value = BusinessException.class)
    public ResponseEntity<ErrorResponse> businessExceptionHandler(BusinessException e) {
        return serverErrorResponse(ApiCode.BUSINESS_EXCEPTION, e);
    }

    @ExceptionHandler(value = NoSuchDataException.class)
    public ResponseEntity<ErrorResponse> noSuchDataExceptionHandler(NoSuchDataException e) {
        return requestErrorResponse(ApiCode.NOT_FOUND, e);
    }

    @ExceptionHandler(value = DaoException.class)
    public ResponseEntity<ErrorResponse> daoExceptionHandler(DaoException e) {
        return serverErrorResponse(ApiCode.DAO_EXCEPTION, e);
    }

    @ExceptionHandler(value = NoPermissionException.class)
    public ResponseEntity<ErrorResponse> noPermissionExceptionHandler(NoPermissionException e) {
        return requestErrorResponse(ApiCode.NO_PERMISSION, e);
    }

    @ExceptionHandler(value = UnAuthorizedException.class)
    public ResponseEntity<ErrorResponse> unAuthorizedExceptionHandler(UnAuthorizedException e) {
        return requestErrorResponse(ApiCode.UNAUTHENTICATED_EXCEPTION, e);
    }

    @ExceptionHandler(value = RequestVerifyException.class)
    public ResponseEntity<ErrorResponse> requestVerifyExceptionHandler(RequestVerifyException e) {
        return requestErrorResponse(ApiCode.PARAMETER_EXCEPTION, e);
    }

    /**
     * handle spring valid exception
     */
    @ExceptionHandler(value = BindException.class)
    public ResponseEntity<ErrorResponse> bindExceptionHandler(BindException e) {
        return requestErrorResponse(ApiCode.PARAMETER_EXCEPTION, e);
    }

    @ExceptionHandler(value = ServletRequestBindingException.class)
    public ResponseEntity<ErrorResponse> servletRequestBindingExceptionHandler(ServletRequestBindingException e) {
        return requestErrorResponse(ApiCode.PARAMETER_EXCEPTION, e);
    }

}
