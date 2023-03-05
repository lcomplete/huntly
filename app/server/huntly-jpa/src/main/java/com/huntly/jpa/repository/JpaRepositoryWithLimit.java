package com.huntly.jpa.repository;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

import java.io.Serializable;
import java.util.List;

/**
 * @author lcomplete
 */
@NoRepositoryBean
public interface JpaRepositoryWithLimit<T,ID extends Serializable> extends JpaRepository<T,ID> {
    
    List<T> findAll(Specification<T> spec, int offset, int maxResults, Sort sort);
    
    List<T> findAll(Specification<T> spec, int offset, int maxResults);
    
    List<T> findAll(Specification<T> spec, int maxResults, Sort sort);
    
    List<T> findAll(Specification<T> spec, int maxResults);
}
