package com.huntly.jpa.query.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target({ElementType.FIELD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface OrderBy {

    int priority() default 10;

    String path() default "";

    OrderType type() default OrderType.ASC;

    enum OrderType {
        ASC, DESC
    }
}
