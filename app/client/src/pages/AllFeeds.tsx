import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import navLabels from "../components/Navigation/shared/NavLabels";
import {PageControllerApiFactory} from "../api";
import {ConnectorType} from "../interfaces/connectorType";
import {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";
import {getPageListFilter} from "../domain/utils";

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
    hideContentTypeFilter: true,
    showAllArticles: false,
    showAllArticlesOption: true
  })

  function handleFilterChange(options: PageFilterOptions) {
    setPageFilterOptions(options);
  }

  return (
    <MainContainer>
      <PageList navLabel={navLabels.allFeeds}
                filters={{
                  ...getPageListFilter(pageFilterOptions),
                  connectorType: ConnectorType.RSS,
                  markRead: pageFilterOptions.showAllArticles ? undefined : false,
                }}
                showMarkReadOption={true}
                onMarkAllAsRead={markAllAsRead}
                hasMarkReadOnScrollFeature={true}
                filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
      />
    </MainContainer>
  )
};

export default AllFeeds;
