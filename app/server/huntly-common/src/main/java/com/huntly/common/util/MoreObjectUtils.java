package com.huntly.common.util;

import lombok.experimental.UtilityClass;

/**
 * @author lcomplete
 */
@UtilityClass
public class MoreObjectUtils {
    public static <T> T firstNonNull(T... items) {
        for (T i : items) {
            if (i != null) {
                return i;
            }
        }
        return null;
    }

    // below firstNonNull functions are for efficient reasons

    public static <T> T firstNonNull(T a, T b) {
        return a == null ? b : a;
    }

    public static <T> T firstNonNull(T a, T b, T c) {
        return a != null ? a : (b != null ? b : c);
    }

    public static <T> T firstNonNull(T a, T b, T c, T d) {
        return a != null ? a : (b != null ? b : (c != null ? c : d));
    }
}
