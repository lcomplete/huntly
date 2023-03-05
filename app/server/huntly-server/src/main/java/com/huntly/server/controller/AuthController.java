package com.huntly.server.controller;

import com.huntly.common.api.ApiResult;
import com.huntly.interfaces.external.dto.LoginUserInfo;
import com.huntly.interfaces.external.model.LoginRequest;
import com.huntly.server.domain.constant.AppConstants;
import com.huntly.server.repository.UserRepository;
import com.huntly.server.security.jwt.JwtUtils;
import com.huntly.server.service.UserService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.validation.Valid;
import java.security.Principal;

/**
 * @author lcomplete
 */
@RestController
@RequestMapping("/auth")
public class AuthController {
    private final UserService userService;

    private final JwtUtils jwtUtils;

    private final AuthenticationManager authenticationManager;

    public AuthController(UserService userService, JwtUtils jwtUtils, AuthenticationManager authenticationManager) {
        this.userService = userService;
        this.jwtUtils = jwtUtils;
        this.authenticationManager = authenticationManager;
    }

    @PostMapping("/signin")
    public ApiResult<String> signin(@RequestBody @Valid LoginRequest loginRequest, HttpServletResponse response) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword()));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        userService.updateLastLoginAt(loginRequest.getUsername());
        
        String jwt = jwtUtils.generateJwtToken(authentication);
        addJwtToCookie(response, jwt);
        return ApiResult.ok(jwt);
    }

    private void addJwtToCookie(HttpServletResponse response, String jwt) {
        Cookie cookie = new Cookie(AppConstants.AUTH_TOKEN_COOKIE_NAME, jwt);
        cookie.setHttpOnly(true);
        //cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(jwtUtils.getJwtExpirationSeconds());
        response.addCookie(cookie);
    }

    @PostMapping("/signup")
    public ApiResult<String> signup(@RequestBody @Valid LoginRequest loginRequest) {
        userService.createUser(loginRequest.getUsername(), loginRequest.getPassword());
        return ApiResult.ok("User registered successfully!");
    }

    @PostMapping("/signOut")
    public ApiResult<String> singOut(HttpServletRequest request, HttpServletResponse response) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (cookie.getName().equals(AppConstants.AUTH_TOKEN_COOKIE_NAME)) {
                    cookie.setMaxAge(0);
                    cookie.setPath("/");
                    response.addCookie(cookie);
                }
            }
        }
        return ApiResult.ok("logout success");
    }
    
    @GetMapping("/loginUserInfo")
    public LoginUserInfo loginUserInfo(Principal principal) {
        LoginUserInfo userInfo= new LoginUserInfo();
        if(principal!=null){
            userInfo.setUsername(principal.getName());
        }
        return userInfo;
    }
    
    @GetMapping("/isUserSet")
    public ApiResult<Boolean> isUserSet(){
        return ApiResult.ok(userService.isUserSet());
    }
}
