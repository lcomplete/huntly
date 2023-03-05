package com.huntly.common.util;

import java.util.Map;

/**
 * @author lcomplete
 */
public class MapUtils {
    /**
     * Map是否为空
     *
     * @param map 集合
     * @return 是否为空
     */
    public static boolean isEmpty(Map<?, ?> map) {
        return null == map || map.isEmpty();
    }
}
