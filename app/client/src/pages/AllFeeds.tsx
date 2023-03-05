import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import navLabels from "../components/Sidebar/NavLabels";
import {PageControllerApiFactory} from "../api";
import {ConnectorType} from "../interfaces/connectorType";
import {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";

const AllFeeds = () => {
  function markAllAsRead() {
    return PageControllerApiFactory().markReadByConnectorTypeUsingPOST(ConnectorType.RSS);
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
      <PageList navLabel={navLabels.allFeeds}
                filters={{
                  sort: pageFilterOptions.defaultSortValue,
                  connectorType: ConnectorType.RSS,
                  markRead: false,
                  asc: pageFilterOptions.asc
                }}
                showMarkReadOption={true}
                onMarkAllAsRead={markAllAsRead}
                filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
      />
    </MainContainer>
  )
};

export default AllFeeds;
