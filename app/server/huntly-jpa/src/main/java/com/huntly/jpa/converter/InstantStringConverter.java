package com.huntly.jpa.converter;

import javax.persistence.AttributeConverter;
import javax.persistence.Converter;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * JPA AttributeConverter for Instant to SQLite TEXT format.
 *
 * <p>SQLite with {@code date_class=TEXT} stores dates as TEXT in format
 * "YYYY-MM-DD HH:MM:SS.sss". This converter ensures consistent format
 * for both reading and writing, which is critical for correct date comparison queries.
 *
 * <p>Without this converter, Hibernate may use ISO format (2026-01-11T13:00:00Z)
 * for query parameters while the database stores "2026-01-11 21:00:00.000",
 * causing string comparison failures in SQLite due to lexicographic comparison
 * (space character vs 'T').
 *
 * <p>IMPORTANT: All times are stored and read using the system default timezone
 * for backward compatibility with existing data. This means the database stores
 * local time, not UTC.
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
     * SQLite TEXT date format: YYYY-MM-DD HH:MM:SS.sss.
     * Uses space separator (not 'T') to match SQLite JDBC driver format.
     */
    private static final DateTimeFormatter SQLITE_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");

    /**
     * Alternative format without milliseconds for legacy data.
     */
    private static final DateTimeFormatter SQLITE_FORMAT_NO_MILLIS =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * System default timezone for backward compatibility with existing data.
     */
    private static final ZoneId ZONE_ID = ZoneId.systemDefault();

    @Override
    public String convertToDatabaseColumn(Instant instant) {
        if (instant == null) {
            return null;
        }
        // Format as LocalDateTime in system default timezone, then convert to string
        LocalDateTime ldt = LocalDateTime.ofInstant(instant, ZONE_ID);
        return SQLITE_FORMAT.format(ldt);
    }

    @Override
    public Instant convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isEmpty()) {
            return null;
        }

        // SQLite JDBC stores datetime as local time string "yyyy-MM-dd HH:mm:ss.SSS"
        // We parse it as LocalDateTime and convert to Instant using system timezone
        // This matches how the JDBC driver originally handled it
        try {
            LocalDateTime ldt = LocalDateTime.parse(dbData, SQLITE_FORMAT);
            return ldt.atZone(ZONE_ID).toInstant();
        } catch (DateTimeParseException e) {
            try {
                LocalDateTime ldt = LocalDateTime.parse(dbData, SQLITE_FORMAT_NO_MILLIS);
                return ldt.atZone(ZONE_ID).toInstant();
            } catch (DateTimeParseException e2) {
                // Should not happen with normal data, but handle gracefully
                throw new IllegalArgumentException("Cannot parse date: " + dbData, e2);
            }
        }
    }
}

