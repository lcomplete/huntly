package com.huntly.server.repository;

import com.huntly.jpa.repository.JpaRepositoryWithLimit;
import com.huntly.jpa.repository.JpaSpecificationExecutorWithProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.repository.NoRepositoryBean;

import java.io.Serializable;

/**
 * @author lcomplete
 */
@NoRepositoryBean
public interface BaseRepository<T,ID extends Serializable> extends JpaRepository<T,ID>, JpaSpecificationExecutor<T>, JpaSpecificationExecutorWithProjection<T>, JpaRepositoryWithLimit<T, ID> {
}
