package com.huntly.common.util;

import lombok.experimental.UtilityClass;
import org.apache.commons.lang3.ObjectUtils;

/**
 * @author lcomplete
 */
@UtilityClass
public class NumberUtils {

    public static Integer safeSum(Integer a, Integer b) {
        return ObjectUtils.defaultIfNull(a, 0) + ObjectUtils.defaultIfNull(b, 0);
    }

    public static Integer safeSum(int a, Integer b) {
        return a + ObjectUtils.defaultIfNull(b, 0);
    }

    public static Integer safeSum(Integer a, int b) {
        return ObjectUtils.defaultIfNull(a, 0) + b;
    }

}
