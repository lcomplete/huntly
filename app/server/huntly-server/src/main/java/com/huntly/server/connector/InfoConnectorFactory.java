package com.huntly.server.connector;

import com.huntly.common.enums.BaseEnum;
import com.huntly.server.connector.github.GithubConnector;
import com.huntly.server.connector.rss.RSSConnector;
import lombok.experimental.UtilityClass;
import org.apache.commons.lang3.NotImplementedException;
import org.apache.commons.lang3.StringUtils;

/**
 * @author lcomplete
 */
@UtilityClass
public class InfoConnectorFactory {
    public static InfoConnector createInfoConnector(Integer connectorType, ConnectorProperties connectorProperties) {
        ConnectorType type = BaseEnum.valueOf(ConnectorType.class, connectorType);
        if (type == null) {
            return null;
        }
        if (ConnectorType.RSS.equals(type)) {
            return new RSSConnector(connectorProperties);
        }
        if (ConnectorType.GITHUB.equals(type) && StringUtils.isNotBlank(connectorProperties.getApiToken())) {
            return new GithubConnector(connectorProperties);
        }
        throw new NotImplementedException("connector type not implemented");
    }
}
