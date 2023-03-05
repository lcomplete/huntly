/**
 * Copyright © 2019, Wen Hao <wenhao@126.com>.
 * <p>
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * <p>
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * <p>
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
package com.huntly.jpa.spec;

import static javax.persistence.criteria.Predicate.BooleanOperator.OR;

import com.huntly.jpa.spec.specification.*;
import org.springframework.data.jpa.domain.Specification;

import javax.persistence.criteria.CriteriaBuilder;
import javax.persistence.criteria.CriteriaQuery;
import javax.persistence.criteria.Predicate;
import javax.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

public class PredicateBuilder<T> {

    private final Predicate.BooleanOperator operator;

    private List<Specification<T>> specifications;

    public PredicateBuilder(Predicate.BooleanOperator operator) {
        this.operator = operator;
        this.specifications = new ArrayList<>();
    }

    public PredicateBuilder<T> eq(String property, Object... values) {
        return eq(true, property, values);
    }

    public PredicateBuilder<T> eq(boolean condition, String property, Object... values) {
        return this.predicate(condition, new EqualSpecification<T>(property, values));
    }

    public PredicateBuilder<T> ne(String property, Object... values) {
        return ne(true, property, values);
    }

    public PredicateBuilder<T> ne(boolean condition, String property, Object... values) {
        return this.predicate(condition, new NotEqualSpecification<T>(property, values));
    }

    public PredicateBuilder<T> gt(String property, Comparable<?> compare) {
        return gt(true, property, compare);
    }

    public PredicateBuilder<T> gt(boolean condition, String property, Comparable<?> compare) {
        return this.predicate(condition, new GtSpecification<T>(property, compare));
    }

    public PredicateBuilder<T> ge(String property, Comparable<?> compare) {
        return ge(true, property, compare);
    }

    public PredicateBuilder<T> ge(boolean condition, String property, Comparable<? extends Object> compare) {
        return this.predicate(condition, new GeSpecification<T>(property, compare));
    }

    public PredicateBuilder<T> lt(String property, Comparable<?> number) {
        return lt(true, property, number);
    }

    public PredicateBuilder<T> lt(boolean condition, String property, Comparable<?> compare) {
        return this.predicate(condition, new LtSpecification<T>(property, compare));
    }

    public PredicateBuilder<T> le(String property, Comparable<?> compare) {
        return le(true, property, compare);
    }

    public PredicateBuilder<T> le(boolean condition, String property, Comparable<?> compare) {
        return this.predicate(condition, new LeSpecification<T>(property, compare));
    }

    public PredicateBuilder<T> between(String property, Object lower, Object upper) {
        return between(true, property, lower, upper);
    }

    public PredicateBuilder<T> between(boolean condition, String property, Object lower, Object upper) {
        return this.predicate(condition, new BetweenSpecification<T>(property, lower, upper));
    }

    public PredicateBuilder<T> like(String property, String... patterns) {
        return like(true, property, patterns);
    }

    public PredicateBuilder<T> like(boolean condition, String property, String... patterns) {
        return this.predicate(condition, new LikeSpecification<T>(property, patterns));
    }

    public PredicateBuilder<T> notLike(String property, String... patterns) {
        return notLike(true, property, patterns);
    }

    public PredicateBuilder<T> notLike(boolean condition, String property, String... patterns) {
        return this.predicate(condition, new NotLikeSpecification<T>(property, patterns));
    }

    public PredicateBuilder<T> in(String property, Collection<?> values) {
        return this.in(true, property, values);
    }

    public PredicateBuilder<T> in(boolean condition, String property, Collection<?> values) {
        return this.predicate(condition, new InSpecification<T>(property, values));
    }

    public PredicateBuilder<T> notIn(String property, Collection<?> values) {
        return this.notIn(true, property, values);
    }

    public PredicateBuilder<T> notIn(boolean condition, String property, Collection<?> values) {
        return this.predicate(condition, new NotInSpecification<T>(property, values));
    }

    public PredicateBuilder<T> predicate(Specification specification) {
        return predicate(true, specification);
    }

    public PredicateBuilder<T> predicate(boolean condition, Specification specification) {
        if (condition) {
            this.specifications.add(specification);
        }
        return this;
    }

    public Specification<T> build() {
        return (Root<T> root, CriteriaQuery<?> query, CriteriaBuilder cb) -> {
            Predicate[] predicates = new Predicate[specifications.size()];
            for (int i = 0; i < specifications.size(); i++) {
                predicates[i] = specifications.get(i).toPredicate(root, query, cb);
            }
            if (Objects.equals(predicates.length, 0)) {
                return null;
            }
            return OR.equals(operator) ? cb.or(predicates) : cb.and(predicates);
        };
    }
}
