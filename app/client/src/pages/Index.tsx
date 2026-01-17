import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import navLabels from "../components/Navigation/shared/NavLabels";
import React, {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";
import {getPageListFilter} from "../domain/utils";


const Index = () => {
  const [pageFilterOptions, setPageFilterOptions] = useState<PageFilterOptions>({
    defaultSortValue: 'LAST_READ_AT',
    sortFields: [{
      value: 'LAST_READ_AT',
      label: 'Recently read'
    }],
    asc: false,
  })

  function handleFilterChange(options: PageFilterOptions) {
    setPageFilterOptions(options);
  }

  return (
    <MainContainer>
      <PageList navLabel={navLabels.recently} buttonOptions={{markRead: false}} showMarkReadOption={true} filters={{
        ...getPageListFilter(pageFilterOptions),
      }} filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
      />
    </MainContainer>
  )
};

export default Index;
