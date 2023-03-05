package com.huntly.common.util;

import lombok.experimental.UtilityClass;
import org.apache.commons.lang3.StringUtils;

/**
 * @author lcomplete
 */
@UtilityClass
public class XmlUtils {
    public static String removeInvalidXmlCharacters(String xml) {
        if (StringUtils.isBlank(xml)) {
            return null;
        }
        StringBuilder sb = new StringBuilder();

        boolean firstTagFound = false;
        for (int i = 0; i < xml.length(); i++) {
            char c = xml.charAt(i);

            if (!firstTagFound) {
                if (c == '<') {
                    firstTagFound = true;
                } else {
                    continue;
                }
            }

            if (c >= 32 || c == 9 || c == 10 || c == 13) {
                if (!Character.isHighSurrogate(c) && !Character.isLowSurrogate(c)) {
                    sb.append(c);
                }
            }
        }
        return sb.toString();
    }
}
