package com.huntly.server.cache;

import com.huntly.server.domain.entity.Connector;
import com.huntly.server.domain.entity.Source;
import com.huntly.server.repository.ConnectorRepository;
import com.huntly.server.repository.SourceRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * @author lcomplete
 */
@Service
public class CacheService {

    private final ConnectorRepository connectorRepository;

    private final SourceRepository sourceRepository;

    public CacheService(ConnectorRepository connectorRepository, SourceRepository sourceRepository) {
        this.connectorRepository = connectorRepository;
        this.sourceRepository = sourceRepository;
    }

    // todo add cache
    public Optional<Connector> getConnector(Integer id) {
        return connectorRepository.findById(id);
    }

    // todo add Cacheable
    public Optional<Source> getSource(Integer id) {
        var source = sourceRepository.findById(id);
        return source;
    }
}
