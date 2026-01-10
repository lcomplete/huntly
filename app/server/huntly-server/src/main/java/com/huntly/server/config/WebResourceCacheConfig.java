package com.huntly.server.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

@Configuration
public class WebResourceCacheConfig {

    @Bean
    public FilterRegistrationBean<OncePerRequestFilter> staticResourceCacheFilter() {
        FilterRegistrationBean<OncePerRequestFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                    FilterChain filterChain) throws ServletException, IOException {
                String path = request.getRequestURI();
                String cacheHeader = getCacheControlHeader(path);
                if (cacheHeader != null) {
                    response.setHeader("Cache-Control", cacheHeader);
                }
                filterChain.doFilter(request, response);
            }
        });
        registration.addUrlPatterns("/*");
        registration.setOrder(1);
        return registration;
    }

    private String getCacheControlHeader(String path) {
        // index.html 不缓存
        if (path.endsWith("/index.html") || path.equals("/")) {
            return CacheControl.noCache().getHeaderValue();
        }
        // 带 hash 的 js/css 文件长期缓存
        if (path.startsWith("/static/js/") || path.startsWith("/static/css/")) {
            return CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic().getHeaderValue();
        }
        // 媒体文件缓存1天
        if (path.startsWith("/static/media/")) {
            return CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic().getHeaderValue();
        }
        // 根目录图片缓存1天
        if (path.matches("^/[^/]+\\.(png|jpg|jpeg|gif|webp|svg|ico)$")) {
            return CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic().getHeaderValue();
        }
        return null;
    }
}
