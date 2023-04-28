import PageList from "../components/PageList";
import navLabels from "../components/Sidebar/NavLabels";
import MainContainer from "../components/MainContainer";
import React, {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";

export default function Twitter() {
  const [pageFilterOptions, setPageFilterOptions] = useState<PageFilterOptions>({
    defaultSortValue: 'CREATED_AT',
    sortFields: [{
      value: 'CREATED_AT',
      label: 'Recently hunted'
    }, {
      value: 'CONNECTED_AT',
      label: 'Recently tweeted'
    }, {
      value: 'LAST_READ_AT',
      label: 'Recently read'
    }, {
      value: 'VOTE_SCORE',
      label: 'Most popular'
    }],
    asc: false,
    hideContentTypeFilter: true
  })

  function handleFilterChange(options: PageFilterOptions) {
    setPageFilterOptions(options);
  }

  return <MainContainer>
    <PageList navLabel={navLabels.twitter}
              filters={{contentType: 'TWEET', sort: pageFilterOptions.defaultSortValue, asc: pageFilterOptions.asc}}
              buttonOptions={{markRead: false}}
              filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}/>
  </MainContainer>;
}