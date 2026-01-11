package com.huntly.server.data.converter;

import javax.persistence.AttributeConverter;
import javax.persistence.Converter;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * JPA AttributeConverter for Instant to SQLite TEXT format.
 *
 * <p>SQLite with {@code date_class=TEXT} stores dates as TEXT in format
 * "YYYY-MM-DD HH:MM:SS.sss" (UTC). This converter ensures consistent format
 * for both reading and writing, which is critical for correct date comparison queries.
 *
 * <p>Without this converter, Hibernate may use ISO format (2026-01-11T13:00:00Z)
 * for query parameters while the database stores "2026-01-11 13:00:00.000",
 * causing string comparison failures in SQLite due to lexicographic comparison
 * (space character vs 'T').
 *
 * <p>This converter only applies when the JDBC driver is SQLite (org.sqlite.JDBC).
 * For other databases, it passes through without conversion.
 *
 * <p>All times are stored and read as UTC.
 *
 * <p>Reference:
 * <ul>
 *   <li><a href="https://github.com/jakartaee/persistence/issues/163">Jakarta Persistence Issue #163</a> -
 *       recommends using AttributeConverter for Instant</li>
 *   <li><a href="https://github.com/xerial/sqlite-jdbc">SQLite JDBC</a> -
 *       date_class=TEXT configuration</li>
 * </ul>
 *
 * @author lcomplete
 */
@Converter(autoApply = true)
public class InstantStringConverter implements AttributeConverter<Instant, String> {

    /**
     * SQLite TEXT date format: YYYY-MM-DD HH:MM:SS.sss (UTC).
     * Uses space separator (not 'T') to match SQLite JDBC driver format.
     */
    private static final DateTimeFormatter SQLITE_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS").withZone(ZoneOffset.UTC);

    @Override
    public String convertToDatabaseColumn(Instant instant) {
        if (instant == null) {
            return null;
        }
        return SQLITE_FORMAT.format(instant);
    }

    @Override
    public Instant convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isEmpty()) {
            return null;
        }
        try {
            // Parse SQLite format with space separator
            return SQLITE_FORMAT.parse(dbData, Instant::from);
        } catch (DateTimeParseException e) {
            // Fallback: try parsing as ISO format for legacy data or other formats
            try {
                return Instant.parse(dbData);
            } catch (DateTimeParseException e2) {
                // Try normalizing space-separated format to ISO format
                String normalized = dbData.replace(" ", "T");
                if (!normalized.endsWith("Z")) {
                    normalized = normalized + "Z";
                }
                return Instant.parse(normalized);
            }
        }
    }
}

