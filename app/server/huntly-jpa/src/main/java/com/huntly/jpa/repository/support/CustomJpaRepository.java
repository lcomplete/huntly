package com.huntly.jpa.repository.support;

import com.huntly.jpa.repository.JpaRepositoryWithLimit;
import com.huntly.jpa.repository.JpaSpecificationExecutorWithProjection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.query.Jpa21Utils;
import org.springframework.data.jpa.repository.query.JpaEntityGraph;
import org.springframework.data.jpa.repository.support.JpaEntityInformation;
import org.springframework.data.jpa.repository.support.SimpleJpaRepository;
import org.springframework.data.projection.ProjectionFactory;
import org.springframework.data.projection.SpelAwareProxyProjectionFactory;

import javax.persistence.*;
import java.io.Serializable;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;


/**
 * Created by pramoth on 9/29/2016 AD.
 */
public class CustomJpaRepository<T, ID extends Serializable> extends SimpleJpaRepository<T, ID> implements JpaSpecificationExecutorWithProjection<T>, JpaRepositoryWithLimit<T, ID> {
    private static final Logger log = LoggerFactory.getLogger(CustomJpaRepository.class);

    private final EntityManager entityManager;

    private final ProjectionFactory projectionFactory = new SpelAwareProxyProjectionFactory();

    private final JpaEntityInformation entityInformation;

    public CustomJpaRepository(JpaEntityInformation entityInformation, EntityManager entityManager) {
        super(entityInformation, entityManager);
        this.entityManager = entityManager;
        this.entityInformation = entityInformation;
    }


    @Override
    public <R> Optional<R> findOne(Specification<T> spec, Class<R> projectionType) {
        TypedQuery<T> query = getQuery(spec, Sort.unsorted());
        try {
            T result = query.getSingleResult();
            return Optional.ofNullable(projectionFactory.createProjection(projectionType, result));
        } catch (NoResultException e) {
            return Optional.empty();
        }
    }

    @Override
    public <R> Page<R> findAll(Specification<T> spec, Class<R> projectionType, Pageable pageable) {
        TypedQuery<T> query = getQuery(spec, pageable);
        return readPageWithProjection(spec, projectionType, pageable, query);
    }

    @Override
    public <R> Page<R> findAll(Specification<T> spec, Class<R> projectionType, String namedEntityGraph, org.springframework.data.jpa.repository.EntityGraph.EntityGraphType type, Pageable pageable) {
        EntityGraph<?> entityGraph = this.entityManager.getEntityGraph(namedEntityGraph);
        if (entityGraph == null) {
            throw new IllegalArgumentException("Not found named entity graph -> " + namedEntityGraph);
        }
        TypedQuery<T> query = getQuery(spec, pageable);
        query.setHint(type.getKey(), entityGraph);
        return readPageWithProjection(spec, projectionType, pageable, query);
    }

    @Override
    public <R> Page<R> findAll(Specification<T> spec, Class<R> projectionType, JpaEntityGraph dynamicEntityGraph, Pageable pageable) {
        TypedQuery<T> query = getQuery(spec, pageable);
        Map<String, Object> entityGraphHints = new HashMap<String, Object>();
        Jpa21Utils.getFetchGraphHint(this.entityManager, dynamicEntityGraph, getDomainClass()).forEach(entityGraphHints::put);
        applyEntityGraphQueryHints(query, entityGraphHints);
        return readPageWithProjection(spec, projectionType, pageable, query);
    }

    private <R> Page<R> readPageWithProjection(Specification<T> spec, Class<R> projectionType, Pageable pageable, TypedQuery<T> query) {
        if (log.isDebugEnabled()) {
            query.getHints().forEach((key, value) -> log.info("apply query hints -> {} : {}", key, value));
        }
        Page<T> result = pageable.isUnpaged() ? new PageImpl<>(query.getResultList()) : readPage(query, getDomainClass(), pageable, spec);
        return result.map(item -> projectionFactory.createProjection(projectionType, item));
    }

    private void applyEntityGraphQueryHints(Query query, Map<String, Object> hints) {
        for (Map.Entry<String, Object> hint : hints.entrySet()) {
            query.setHint(hint.getKey(), hint.getValue());
        }
    }

    @Override
    public List<T> findAll(Specification<T> spec, int offset, int maxResults, Sort sort) {
        TypedQuery<T> query = getQuery(spec, sort);

        if (offset < 0) {
            throw new IllegalArgumentException("Offset must not be less than zero!");
        }
        if (maxResults < 1) {
            throw new IllegalArgumentException("Max results must not be less than one!");
        }

        query.setFirstResult(offset);
        query.setMaxResults(maxResults);
        return query.getResultList();
    }

    @Override
    public List<T> findAll(Specification<T> spec, int offset, int maxResults) {
        return findAll(spec, offset, maxResults, null);
    }

    @Override
    public List<T> findAll(Specification<T> spec, int maxResults, Sort sort) {
        return findAll(spec, 0, maxResults, sort);
    }

    @Override
    public List<T> findAll(Specification<T> spec, int maxResults) {
        return findAll(spec, 0, maxResults, null);
    }
}
