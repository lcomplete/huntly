package com.huntly.jpa.query.annotation;


import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Keywords {

    /**
     * 需要查询的字段名，在Specification中称为path（路径）
     * @return
     */
    String[] value() default {""};

    /**
     * @see QueryGroup
     * 该查询的名称，方便我们后面QueryGroup做分组查询
     * @return
     */
    String name() default "";

    /**
     * 模糊查询的前缀，默认为 %
     * @return
     */
    String prefix() default "%";

    /**
     * 模糊查询的后缀，默认为 %
     * @return
     */
    String suffix() default "%";

    /**
     * @see Operator
     * 模糊查询连接条件 分为 AND 和 OR
     * @return
     */
    Operator operator() default Operator.OR;
}
