package com.huntly.server.config;

import com.huntly.jpa.converter.InstantStringConverter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Configuration;

/**
 * JPA configuration that conditionally registers converters based on database type.
 *
 * <p>The {@link InstantStringConverter} is only needed for SQLite because:
 * <ul>
 *   <li>SQLite stores dates as TEXT in format "yyyy-MM-dd HH:mm:ss.SSS"</li>
 *   <li>Hibernate generates ISO format for query parameters by default</li>
 *   <li>This mismatch causes date comparison queries to fail</li>
 * </ul>
 *
 * <p>Other databases (PostgreSQL, MySQL, etc.) handle Instant natively and don't need this converter.
 *
 * @author lcomplete
 */
@Configuration
@ConditionalOnExpression("'${spring.datasource.url:}'.toLowerCase().contains('sqlite')")
@EntityScan(basePackageClasses = InstantStringConverter.class)
public class JpaConverterConfig {
}

