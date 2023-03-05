package com.huntly.server.security.jwt;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huntly.common.api.model.ErrorDetail;
import com.huntly.common.api.model.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * @author lcomplete
 */
@Component
@Slf4j
public class UnAuthEntryPointJwt implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException, ServletException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);

        ErrorDetail errorDetail = new ErrorDetail();
        errorDetail.setCode(HttpServletResponse.SC_UNAUTHORIZED);
        errorDetail.setMessage(authException.getMessage());
        errorDetail.setType("Unauthorized");
        
        ErrorResponse errorResponse = new ErrorResponse();
        errorResponse.setError(errorDetail);
        final ObjectMapper mapper = new ObjectMapper();
        mapper.writeValue(response.getOutputStream(), errorResponse);
    }
}
