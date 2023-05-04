import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import navLabels from "../components/Sidebar/NavLabels";
import {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";
import {getPageListFilter} from "../domain/utils";

const MyList = () => {
  const [pageFilterOptions, setPageFilterOptions] = useState<PageFilterOptions>({
    defaultSortValue: 'STARRED_AT',
    sortFields: [{
      value: 'STARRED_AT',
      label: 'Recently starred'
    }],
    asc: false,
  })

  function handleFilterChange(options: PageFilterOptions) {
    setPageFilterOptions(options);
  }

  return (
    <MainContainer>
      <PageList navLabel={navLabels.starred}
                filters={{
                  ...getPageListFilter(pageFilterOptions),
                  starred: true
                }}
                buttonOptions={{markRead: false}}
                filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
      />
    </MainContainer>
  )
};

export default MyList;
