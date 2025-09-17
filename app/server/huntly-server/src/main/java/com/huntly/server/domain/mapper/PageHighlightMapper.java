package com.huntly.server.domain.mapper;

import com.huntly.interfaces.external.dto.PageHighlightDto;
import com.huntly.server.domain.entity.PageHighlight;
import org.mapstruct.Mapper;
import org.mapstruct.factory.Mappers;

import java.util.List;

@Mapper
public interface PageHighlightMapper {
    PageHighlightMapper INSTANCE = Mappers.getMapper(PageHighlightMapper.class);

    PageHighlightDto toDto(PageHighlight pageHighlight);

    List<PageHighlightDto> toDtoList(List<PageHighlight> pageHighlights);
}