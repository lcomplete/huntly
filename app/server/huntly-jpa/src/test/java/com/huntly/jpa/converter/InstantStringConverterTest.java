package com.huntly.jpa.converter;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for InstantStringConverter.
 *
 * Note: This converter uses the system default timezone for backward compatibility
 * with existing data. Tests are designed to work regardless of the system timezone.
 */
class InstantStringConverterTest {

    private InstantStringConverter converter;

    private static final DateTimeFormatter SQLITE_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");

    private static final ZoneId ZONE_ID = ZoneId.systemDefault();

    @BeforeEach
    void setUp() {
        converter = new InstantStringConverter();
    }

    // ==================== convertToDatabaseColumn tests ====================

    @Test
    void convertToDatabaseColumn_nullInstant_returnsNull() {
        String result = converter.convertToDatabaseColumn(null);
        assertThat(result).isNull();
    }

    @Test
    void convertToDatabaseColumn_validInstant_returnsFormattedString() {
        Instant instant = Instant.parse("2026-01-11T13:30:45.123Z");

        String result = converter.convertToDatabaseColumn(instant);

        // Should be formatted as local time in SQLite format
        LocalDateTime expectedLdt = LocalDateTime.ofInstant(instant, ZONE_ID);
        String expected = SQLITE_FORMAT.format(expectedLdt);
        assertThat(result).isEqualTo(expected);
    }

    @Test
    void convertToDatabaseColumn_instantWithZeroMillis_returnsFormattedString() {
        Instant instant = Instant.parse("2026-01-11T00:00:00Z");

        String result = converter.convertToDatabaseColumn(instant);

        LocalDateTime expectedLdt = LocalDateTime.ofInstant(instant, ZONE_ID);
        String expected = SQLITE_FORMAT.format(expectedLdt);
        assertThat(result).isEqualTo(expected);
        assertThat(result).endsWith(".000");
    }

    @Test
    void convertToDatabaseColumn_epochInstant_returnsFormattedString() {
        Instant instant = Instant.EPOCH;

        String result = converter.convertToDatabaseColumn(instant);

        LocalDateTime expectedLdt = LocalDateTime.ofInstant(instant, ZONE_ID);
        String expected = SQLITE_FORMAT.format(expectedLdt);
        assertThat(result).isEqualTo(expected);
    }

    // ==================== convertToEntityAttribute tests ====================

    @Test
    void convertToEntityAttribute_nullString_returnsNull() {
        Instant result = converter.convertToEntityAttribute(null);
        assertThat(result).isNull();
    }

    @Test
    void convertToEntityAttribute_emptyString_returnsNull() {
        Instant result = converter.convertToEntityAttribute("");
        assertThat(result).isNull();
    }

    @Test
    void convertToEntityAttribute_sqliteFormatWithMillis_returnsInstant() {
        LocalDateTime ldt = LocalDateTime.of(2026, 1, 11, 21, 30, 45, 123_000_000);
        String dbData = "2026-01-11 21:30:45.123";

        Instant result = converter.convertToEntityAttribute(dbData);

        Instant expected = ldt.atZone(ZONE_ID).toInstant();
        assertThat(result).isEqualTo(expected);
    }

    @Test
    void convertToEntityAttribute_sqliteFormatWithoutMillis_returnsInstant() {
        LocalDateTime ldt = LocalDateTime.of(2026, 1, 11, 21, 30, 45);
        String dbData = "2026-01-11 21:30:45";

        Instant result = converter.convertToEntityAttribute(dbData);

        Instant expected = ldt.atZone(ZONE_ID).toInstant();
        assertThat(result).isEqualTo(expected);
    }

    // ==================== Round-trip tests ====================

    @Test
    void roundTrip_convertToDbAndBack_preservesInstant() {
        Instant original = Instant.parse("2026-01-11T13:30:45.123Z");

        String dbValue = converter.convertToDatabaseColumn(original);
        Instant restored = converter.convertToEntityAttribute(dbValue);

        assertThat(restored).isEqualTo(original);
    }

    @Test
    void roundTrip_multipleInstants_allPreserved() {
        Instant[] instants = {
            Instant.EPOCH,
            Instant.parse("2000-01-01T00:00:00Z"),
            Instant.parse("2026-06-15T23:59:59.999Z"),
            Instant.now()
        };

        for (Instant original : instants) {
            // Truncate to milliseconds since our format only supports millis
            Instant truncated = Instant.ofEpochMilli(original.toEpochMilli());

            String dbValue = converter.convertToDatabaseColumn(truncated);
            Instant restored = converter.convertToEntityAttribute(dbValue);

            assertThat(restored).isEqualTo(truncated);
        }
    }

    // ==================== SQLite comparison tests ====================

    @Test
    void sqliteStringComparison_olderDateIsLexicographicallySmaller() {
        Instant older = Instant.parse("2025-01-01T00:00:00Z");
        Instant newer = Instant.parse("2026-01-01T00:00:00Z");

        String olderStr = converter.convertToDatabaseColumn(older);
        String newerStr = converter.convertToDatabaseColumn(newer);

        // SQLite compares dates as strings, so lexicographic order must match chronological order
        assertThat(olderStr.compareTo(newerStr)).isLessThan(0);
    }

    @Test
    void sqliteStringComparison_sameDay_timeOrderingCorrect() {
        Instant morning = Instant.parse("2026-01-11T08:00:00Z");
        Instant afternoon = Instant.parse("2026-01-11T14:00:00Z");
        Instant evening = Instant.parse("2026-01-11T20:00:00Z");

        String morningStr = converter.convertToDatabaseColumn(morning);
        String afternoonStr = converter.convertToDatabaseColumn(afternoon);
        String eveningStr = converter.convertToDatabaseColumn(evening);

        assertThat(morningStr.compareTo(afternoonStr)).isLessThan(0);
        assertThat(afternoonStr.compareTo(eveningStr)).isLessThan(0);
    }
}

