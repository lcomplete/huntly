package com.huntly.interfaces.external.dto;

import lombok.Data;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Min;

/**
 * @author lcomplete
 */
@Data
public class CreateHighlightRequest {

    @NotNull
    private Long pageId;

    @NotBlank
    private String highlightedText;

    @NotNull
    @Min(0)
    private Integer startOffset;

    @NotNull
    @Min(0)
    private Integer endOffset;
}
