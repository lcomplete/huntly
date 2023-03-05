package com.huntly.server.repository;

import com.huntly.server.domain.entity.Folder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FolderRepository extends JpaRepository<Folder, Integer>, JpaSpecificationExecutor<Folder> {
    Optional<Folder> findByName(String name);
}