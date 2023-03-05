package com.huntly.server.service;

import com.huntly.common.exceptions.DuplicateRecordException;
import com.huntly.server.domain.entity.Folder;
import com.huntly.server.repository.ConnectorRepository;
import com.huntly.server.repository.FolderRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * @author lcomplete
 */
@Service
public class FolderService {

    private final FolderRepository folderRepository;

    private final ConnectorRepository connectorRepository;

    public FolderService(FolderRepository folderRepository, ConnectorRepository connectorRepository) {
        this.folderRepository = folderRepository;
        this.connectorRepository = connectorRepository;
    }

    public Folder saveWhenNotExist(Folder folder) {
        Optional<Folder> existFolder = folderRepository.findByName(folder.getName());
        if (existFolder.isEmpty()) {
            folderRepository.save(folder);
        } else {
            folder = existFolder.get();
        }
        return folder;
    }

    private Folder requireOne(Integer id) {
        return folderRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Folder Resource not found: " + id));
    }

    public List<Folder> getSortedFolders() {
        return folderRepository.findAll(Sort.sort(Folder.class).by(Folder::getDisplaySequence).ascending());
    }

    public Folder save(Folder folder) {
        if (folder.getId() == null) {
            var existsFolder = folderRepository.findByName(folder.getName());
            if (existsFolder.isPresent()) {
                throw new DuplicateRecordException("Folder name already exists: " + folder.getName());
            }
            if (folder.getDisplaySequence() == null) {
                folder.setDisplaySequence(1);
            }
            folder.setCreatedAt(Instant.now());
            return folderRepository.save(folder);
        } else {
            var oldFolder = requireOne(folder.getId());
            oldFolder.setName(folder.getName());
            return folderRepository.save(oldFolder);
        }
    }

    public void delete(Integer folderId) {
        var folder = requireOne(folderId);
        folderRepository.delete(folder);
        var connectors = connectorRepository.findByFolderId(folderId);
        connectors.forEach(connector -> {
            connector.setFolderId(null);
            connectorRepository.save(connector);
        });
    }

    public void resortFolders(List<Integer> folderIds) {
        folderIds = folderIds.stream().filter(f -> f != null && f > 0).collect(Collectors.toList());
        for (int i = 0; i < folderIds.size(); i++) {
            var folder = requireOne(folderIds.get(i));
            folder.setDisplaySequence(i + 1);
            folderRepository.save(folder);
        }
    }

    public Folder findById(Integer id) {
        return folderRepository.findById(id).orElse(null);
    }
}
