import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import {useParams} from "react-router-dom";
import {safeInt} from "../common/typeUtils";
import {useQuery} from "@tanstack/react-query";
import {Connector, ConnectorControllerApiFactory, PageControllerApiFactory} from "../api";
import navLabels, {NavLabel} from "../components/Sidebar/NavLabels";
import RssFeedIcon from "@mui/icons-material/RssFeed";
import EnergySavingsLeafIcon from "@mui/icons-material/EnergySavingsLeaf";
import {ConnectorType} from "../interfaces/connectorType";
import {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";

const ConnectorList = () => {
  const {id} = useParams<"id">();
  const {
    isLoading,
    error,
    data: connector,
  } = useQuery(["connector_info", id], async () => (await ConnectorControllerApiFactory().getConnectorByIdUsingGET(safeInt(id))).data);

  function getNavLabel(connector: Connector): NavLabel {
    if (connector) {
      if (connector.type === ConnectorType.GITHUB) {
        return {...navLabels.github, labelText: connector.name, linkTo: '/connector/' + id};
      } else if (connector.type == ConnectorType.RSS) {
        return {labelIcon: RssFeedIcon, labelText: connector.name, linkTo: '/connector/' + id};
      }
    }
    return {labelText: '', labelIcon: EnergySavingsLeafIcon};
  }

  function markAllAsRead() {
    return PageControllerApiFactory().markReadByConnectorIdUsingPOST(safeInt(id));
  }

  const [pageFilterOptions, setPageFilterOptions] = useState<PageFilterOptions>({
    defaultSortValue: 'CONNECTED_AT',
    sortFields: [{
      value: 'CONNECTED_AT',
      label: 'Recently connected'
    }],
    asc: false,
  })

  function handleFilterChange(options: PageFilterOptions) {
    setPageFilterOptions(options);
  }

  return (
    <MainContainer>
      <PageList navLabel={getNavLabel(connector)}
                filters={{
                  connectorId: safeInt(id),
                  sort: pageFilterOptions.defaultSortValue,
                  markRead: false,
                  asc: pageFilterOptions.asc
                }}
                onMarkAllAsRead={markAllAsRead} showMarkReadOption={true}
                filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
      />
    </MainContainer>
  )
};

export default ConnectorList;
