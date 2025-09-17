package com.huntly.interfaces.external.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Min;

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