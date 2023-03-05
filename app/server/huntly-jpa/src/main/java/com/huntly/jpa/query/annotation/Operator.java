package com.huntly.jpa.query.annotation;

import javax.persistence.criteria.CriteriaBuilder;
import javax.persistence.criteria.Predicate;
import java.util.Collection;

public enum Operator {
    OR {
        @Override
        public Predicate operation(CriteriaBuilder criteriaBuilder, Collection<Predicate> predicates) {
            return criteriaBuilder.or(predicates.toArray(PREDICATES));
        }
    }, AND {
        @Override
        public Predicate operation(CriteriaBuilder criteriaBuilder, Collection<Predicate> predicates) {
            return criteriaBuilder.and(predicates.toArray(PREDICATES));
        }
    };

    private static final Predicate[] PREDICATES = new Predicate[0];

    public abstract Predicate operation(CriteriaBuilder criteriaBuilder, Collection<Predicate> predicates);

}
