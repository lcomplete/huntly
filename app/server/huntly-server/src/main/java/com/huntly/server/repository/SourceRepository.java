package com.huntly.server.repository;

import com.huntly.server.domain.entity.Source;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SourceRepository extends JpaRepository<Source, Integer>, JpaSpecificationExecutor<Source> {

    Optional<Source> findByDomain(String domain);
}