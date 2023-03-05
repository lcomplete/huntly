package com.huntly.common.util;

import lombok.experimental.UtilityClass;
import org.apache.commons.lang3.CharSet;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@UtilityClass
public class Base64Utils {
    /**
     * use utf-8 decode base64 string
     *
     * @param encodedString
     * @return
     */
    public static String decode(String encodedString) {
        return decode(encodedString, StandardCharsets.UTF_8);
    }

    public static String decode(String encodedString, Charset charset) {
        byte[] decodedBytes = Base64.getDecoder().decode(encodedString.getBytes(charset));
        return new String(decodedBytes);
    }
}
