package com.huntly.server.controller;

import com.huntly.server.domain.entity.Folder;
import com.huntly.server.service.FolderService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;

/**
 * @author lcomplete
 */
@Validated
@RestController
@RequestMapping("/folder")
public class FolderController {

    private final FolderService folderService;

    public FolderController(FolderService folderService) {
        this.folderService = folderService;
    }

    @GetMapping("/{id}")
    public Folder getFolderById(@Valid @NotNull @PathVariable("id") Integer id) {
        return folderService.findById(id);
    }

}
