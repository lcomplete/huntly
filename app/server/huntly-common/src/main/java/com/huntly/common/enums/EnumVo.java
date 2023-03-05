package com.huntly.common.enums;

import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
public class EnumVo<T> {

    /**
     * 枚举code
     */
    private Integer code;

    /**
     * 枚举描述
     */
    private String desc;

    /**
     * 枚举类型
     */
    private T baseEnum;

}
