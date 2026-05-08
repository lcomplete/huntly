package com.huntly.server.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.Collections;

/**
 * Ensures that {@code huntly.dataDir} ends with a path separator so the
 * datasource URL (jdbc:sqlite:${huntly.dataDir:}db.sqlite) resolves to a
 * correct file path on every platform, including when users pass a
 * Windows path without a trailing slash (e.g. {@code C:\Users\name\huntly}).
 *
 * @author lcomplete
 */
public class HuntlyEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    private static final String DATA_DIR_PROPERTY = "huntly.dataDir";
    private static final String PROPERTY_SOURCE_NAME = "huntlyNormalizedProperties";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String dataDir = environment.getProperty(DATA_DIR_PROPERTY);
        if (dataDir == null || dataDir.isEmpty()) {
            return;
        }
        if (dataDir.endsWith("/") || dataDir.endsWith("\\")) {
            return;
        }
        // Forward slash works for SQLite JDBC URLs on every platform and avoids
        // backslash escaping pitfalls.
        String normalized = dataDir + "/";
        MapPropertySource source = new MapPropertySource(
                PROPERTY_SOURCE_NAME,
                Collections.singletonMap(DATA_DIR_PROPERTY, normalized)
        );
        environment.getPropertySources().addFirst(source);
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
