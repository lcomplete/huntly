import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import navLabels from "../components/Navigation/shared/NavLabels";
import {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";
import {getPageListFilter} from "../domain/utils";


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
                filters={{
                  ...getPageListFilter(pageFilterOptions),
                  saveStatus: 'ARCHIVED'
                }}
                buttonOptions={{markRead: false}}
                filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
                defaultSearchKeywords={['archive']}
      />
    </MainContainer>
  )
};

export default MyList;
