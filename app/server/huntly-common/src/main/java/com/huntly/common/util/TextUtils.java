package com.huntly.common.util;

import lombok.experimental.UtilityClass;

/**
 * @author lcomplete
 */
@UtilityClass
public class TextUtils {
    public static String trimTruncate(String str, int length) {
        if (str != null) {
            str = str.trim();
            if (str.length() > length) {
                str = str.substring(0, length);
            }
        }
        return str;
    }
}
