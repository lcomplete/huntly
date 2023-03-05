import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import navLabels from "../components/Sidebar/NavLabels";
import React, {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";


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
        sort: pageFilterOptions.defaultSortValue,
        asc: pageFilterOptions.asc
      }} filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
      />
    </MainContainer>
  )
};

export default Index;
