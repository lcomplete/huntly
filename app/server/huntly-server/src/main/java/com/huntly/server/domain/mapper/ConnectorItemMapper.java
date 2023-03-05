package com.huntly.server.domain.mapper;

import com.huntly.interfaces.external.dto.ConnectorItem;
import com.huntly.server.domain.entity.Connector;
import org.mapstruct.Mapper;
import org.mapstruct.factory.Mappers;

@Mapper
public interface ConnectorItemMapper {
    ConnectorItemMapper INSTANCE = Mappers.getMapper(ConnectorItemMapper.class);
    
    ConnectorItem fromConnector(Connector connector);
}
