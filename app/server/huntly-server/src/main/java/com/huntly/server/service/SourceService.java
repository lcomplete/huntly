package com.huntly.server.service;

import com.huntly.server.domain.entity.Source;
import com.huntly.server.repository.SourceRepository;
import org.springframework.stereotype.Service;

import java.util.NoSuchElementException;
import java.util.Optional;

@Service
public class SourceService {

    private final SourceRepository sourceRepository;

    public SourceService(SourceRepository sourceRepository) {
        this.sourceRepository = sourceRepository;
    }

    public Optional<Source> findById(Integer id) {
        return sourceRepository.findById(id);
    }

    private Source requireOne(Integer id) {
        return sourceRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Resource not found: " + id));
    }
}
