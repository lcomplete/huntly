package com.huntly.server.repository;

import com.huntly.server.domain.entity.Connector;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

/**
 * @author lcomplete
 */
public interface ConnectorRepository extends JpaRepository<Connector, Integer>, JpaSpecificationExecutor<Connector> {
    List<Connector> findByEnabledTrue();

    Optional<Connector> findBySubscribeUrlAndType(String subscribeUrl, Integer type);

    List<Connector> findByFolderId(Integer folderId);

    List<Connector> findByFolderIdAndType(Integer folderId,Integer type, Sort ascending);

    List<Connector> findByType(Integer type);
}