package com.huntly.jpa.query.annotation;

import javax.persistence.criteria.CriteriaBuilder;
import javax.persistence.criteria.Predicate;
import javax.persistence.criteria.Root;
import java.lang.reflect.Array;
import java.util.Collection;
import java.util.List;

@SuppressWarnings({"unchecked", "all"})
public enum QueryType {
    NOT_EQUAL {
        @Override
        public <T> Predicate operation(Root<T> root, CriteriaBuilder criteriaBuilder, String path, Object value) {
            return criteriaBuilder.notEqual(root.get(path).as(value.getClass()), value);
        }
    }, EQUAL {
        @Override
        public <T> Predicate operation(Root<T> root, CriteriaBuilder criteriaBuilder, String path, Object value) {
            return criteriaBuilder.equal(root.get(path).as(value.getClass()), value);
        }
    }, GREATER_THAN {
        @Override
        public <T> Predicate operation(Root<T> root, CriteriaBuilder criteriaBuilder, String path, Object value) {
            return criteriaBuilder.greaterThan(root.get(path), (Comparable) value);
        }
    }, GREATER_THAN_OR_EQUAL {
        @Override
        public <T> Predicate operation(Root<T> root, CriteriaBuilder criteriaBuilder, String path, Object value) {
            return criteriaBuilder.greaterThanOrEqualTo(root.get(path), (Comparable) value);
        }
    }, LESS_THAN {
        @Override
        public <T> Predicate operation(Root<T> root, CriteriaBuilder criteriaBuilder, String path, Object value) {
            return criteriaBuilder.lessThan(root.get(path), (Comparable) value);
        }
    }, LESS_THAN_OR_EQUAL {
        @Override
        public <T> Predicate operation(Root<T> root, CriteriaBuilder criteriaBuilder, String path, Object value) {
            return criteriaBuilder.lessThanOrEqualTo(root.get(path), (Comparable) value);
        }
    }, IS_NULL {
        @Override
        public <T> Predicate operation(Root<T> root, CriteriaBuilder criteriaBuilder, String path, Object value) {
            return criteriaBuilder.isNull(root.get(path));
        }
    }, IS_NOT_NULL {
        @Override
        public <T> Predicate operation(Root<T> root, CriteriaBuilder criteriaBuilder, String path, Object value) {
            return criteriaBuilder.isNotNull(root.get(path));
        }
    }, IS_EMPTY {
        @Override
        public <T> Predicate operation(Root<T> root, CriteriaBuilder criteriaBuilder, String path, Object value) {
            return criteriaBuilder.isEmpty(root.get(path));
        }
    }, IS_NOT_EMPTY {
        @Override
        public <T> Predicate operation(Root<T> root, CriteriaBuilder criteriaBuilder, String path, Object value) {
            return criteriaBuilder.isNotEmpty(root.get(path));
        }
    }, IN {
        @Override
        public <T> Predicate operation(Root<T> root, CriteriaBuilder criteriaBuilder, String path, Object value) {
            if (value instanceof Collection<?>) {
                return root.get(path).in((Collection<?>) value);
            } else if (value.getClass().isArray()) {
                int length = Array.getLength(value);
                Object[] array = new Object[length];
                System.arraycopy(value, 0, array, 0, length);
                return root.get(path).in(array);
            } else {
                return root.get(path).in(value);
            }
        }
    }, BETWEEN {
        @Override
        public <T> Predicate operation(Root<T> root, CriteriaBuilder criteriaBuilder, String path, Object value) {
            Comparable min, max;
            if (value instanceof List<?>) {
                min = (Comparable) ((List<?>) value).get(0);
                max = (Comparable) ((List<?>) value).get(1);
            } else if (value.getClass().isArray()) {
                min = (Comparable) Array.get(value, 0);
                max = (Comparable) Array.get(value, 1);
            } else {
                throw new RuntimeException("value not array or List");
            }
            return criteriaBuilder.between(root.get(path), min, max);
        }
    };

    public abstract <T> Predicate operation(Root<T> root, CriteriaBuilder criteriaBuilder, String path, Object value);
}
