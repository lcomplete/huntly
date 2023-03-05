package com.huntly.jpa.query;

import org.springframework.data.jpa.domain.Specification;

public interface QueryCriteria<T> {
    default Specification<T> toSpecification(){
        return SpecificationUtils.fromQueryCriteria(this);
    }
}
