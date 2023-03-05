package com.huntly.jpa.query.annotation;

import java.lang.annotation.*;

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Repeatable(value = Queries.class)
public @interface Query {

    /**
     * @see QueryType
     * 查询类型
     * NOT_EQUAL 不相等
     * EQUAL 相等
     * GREATER_THAN 大于
     * GREATER_THAN_OR_EQUAL 大于等于
     * LESS_THAN 小于
     * LESS_THAN_OR_EQUAL 小于等于
     * IS_NULL 等于null
     * IS_NOT_NULL 不等于null
     * IN 在集合或数组内 必须注解在 array 或者 Collection上
     * BETWEEN 在范围内 必须注解在 array 或者 List 上，并且元素要大于或等于2
     * @return
     */

    QueryType type() default QueryType.EQUAL;

    /**
     * @see QueryGroup
     * 该查询名称，方便我们后面QueryGroup做分组查询
     * @return 默认使用属性名
     */
    String name() default "";

    /**
     * 查询字段 path
     * @return 优先使用配置的路径，然后使用名称，最后使用属性名
     */
    String path() default "";
}
