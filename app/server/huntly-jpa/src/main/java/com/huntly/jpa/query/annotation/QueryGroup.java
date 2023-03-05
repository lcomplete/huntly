package com.huntly.jpa.query.annotation;

import java.lang.annotation.*;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Repeatable(QueryGroups.class)
public @interface QueryGroup {

    /**
     * 查询名称 可以把几个查询合并为一个查询，然后在用于其他的组
     * @return
     */
    String name();

    /**
     * 查询的目标名称
     * @return
     */
    String[] targetNames() default {};

    /**
     * 分组查询的条件 OR 或 AND
     * @return
     */
    Operator operator() default Operator.AND;

}
