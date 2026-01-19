package com.huntly.server.repository;

import com.huntly.server.domain.entity.CollectionGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CollectionGroupRepository extends JpaRepository<CollectionGroup, Long> {

    List<CollectionGroup> findAllByOrderByDisplaySequenceAsc();

    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, Long id);

}
