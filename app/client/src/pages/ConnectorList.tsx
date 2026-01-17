import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import {useParams} from "react-router-dom";
import {safeInt} from "../common/typeUtils";
import {useQuery} from "@tanstack/react-query";
import {Connector, ConnectorControllerApiFactory, PageControllerApiFactory} from "../api";
import navLabels, {NavLabel} from "../components/Navigation/shared/NavLabels";
import RssFeedIcon from "@mui/icons-material/RssFeed";
import EnergySavingsLeafIcon from "@mui/icons-material/EnergySavingsLeaf";
import {ConnectorType} from "../interfaces/connectorType";
import React, {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";
import {IconButton} from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import FeedsFormDialog from "../components/SettingModal/FeedsFormDialog";
import {getPageListFilter} from "../domain/utils";

const ConnectorList = () => {
  const {id} = useParams<"id">();
  const [editFeedsId, setEditFeedsId] = React.useState<number>(null);

  const {
    isLoading,
    error,
    data: connector,
    refetch: refetchConnector
  } = useQuery(["connector_info", id], async () => (await ConnectorControllerApiFactory().getConnectorByIdUsingGET(safeInt(id))).data);

  function getNavLabel(connector: Connector): NavLabel {
    if (connector) {
      if (connector.type === ConnectorType.GITHUB) {
        return {...navLabels.github, labelText: connector.name, linkTo: '/connector/' + id};
      } else if (connector.type === ConnectorType.RSS) {
        return {
          labelIcon: RssFeedIcon,
          labelText: connector.name,
          linkTo: '/connector/' + id,
          iconUrl: connector.iconUrl
        };
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
    hideContentTypeFilter: true,
    showAllArticles: false,
    showAllArticlesOption: true
  })

  function handleFilterChange(options: PageFilterOptions) {
    setPageFilterOptions(options);
  }

  function navLabelArea() {
    if (connector?.type === ConnectorType.RSS) {
      return <IconButton className={'ml-1'} onClick={() => {
        setEditFeedsId(connector.id)
      }}>
        <EditIcon fontSize={"small"}/>
      </IconButton>
    }
    return null;
  }

  return (
    <MainContainer>
      {
        editFeedsId !== null && <FeedsFormDialog feedsId={editFeedsId} onClose={() => {
          setEditFeedsId(null);
          refetchConnector();
        }}/>
      }
      <PageList navLabel={getNavLabel(connector)}
                navLabelArea={navLabelArea()}
                filters={{
                  ...getPageListFilter(pageFilterOptions),
                  connectorId: safeInt(id),
                  markRead: pageFilterOptions.showAllArticles ? undefined : false,
                }}
                onMarkAllAsRead={markAllAsRead} showMarkReadOption={true}
                hasMarkReadOnScrollFeature={true}
                filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
      />
    </MainContainer>
  )
};

export default ConnectorList;
