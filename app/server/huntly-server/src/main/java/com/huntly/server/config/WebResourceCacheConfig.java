package com.huntly.server.config;

import java.util.concurrent.TimeUnit;
import org.springframework.boot.autoconfigure.web.WebProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebResourceCacheConfig implements WebMvcConfigurer {

    private final WebProperties.Resources resources;

    public WebResourceCacheConfig(WebProperties webProperties) {
        this.resources = webProperties.getResources();
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String[] staticLocations = resources.getStaticLocations();
        CacheControl noCache = CacheControl.noCache();
        CacheControl weekCache = CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic();
        CacheControl dayCache = CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic();

        registry.addResourceHandler("/index.html")
                .addResourceLocations(staticLocations)
                .setCacheControl(noCache);

        registry.addResourceHandler("/static/media/**")
                .addResourceLocations(staticLocations)
                .setCacheControl(dayCache);

        registry.addResourceHandler("/static/js/**", "/static/css/**")
                .addResourceLocations(staticLocations)
                .setCacheControl(weekCache);

        registry.addResourceHandler(
                        "/*.png",
                        "/*.jpg",
                        "/*.jpeg",
                        "/*.gif",
                        "/*.webp",
                        "/*.svg",
                        "/*.ico"
                )
                .addResourceLocations(staticLocations)
                .setCacheControl(dayCache);
    }
}
