import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import navLabels from "../components/Sidebar/NavLabels";
import {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";


const MyList = () => {
  const [pageFilterOptions, setPageFilterOptions] = useState<PageFilterOptions>({
    defaultSortValue: 'ARCHIVED_AT',
    sortFields: [{
      value: 'ARCHIVED_AT',
      label: 'Recently archived'
    }],
    asc: false,
  })

  function handleFilterChange(options: PageFilterOptions) {
    setPageFilterOptions(options);
  }

  return (
    <MainContainer>
      <PageList navLabel={navLabels.archive}
                filters={{saveStatus: 'ARCHIVED', sort: pageFilterOptions.defaultSortValue, asc: pageFilterOptions.asc}}
                buttonOptions={{markRead: false}}
                filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
      />
    </MainContainer>
  )
};

export default MyList;
