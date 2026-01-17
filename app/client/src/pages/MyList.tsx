import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import navLabels from "../components/Navigation/shared/NavLabels";
import {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";
import {getPageListFilter} from "../domain/utils";

const MyList = () => {
  const [pageFilterOptions, setPageFilterOptions] = useState<PageFilterOptions>({
    defaultSortValue: 'SAVED_AT',
    sortFields: [{
      value: 'SAVED_AT',
      label: 'Recently saved'
    }],
    asc: false,
  })

  function handleFilterChange(options: PageFilterOptions) {
    setPageFilterOptions(options);
  }

  return (
    <MainContainer>
      <PageList navLabel={navLabels.myList}
                filters={{
                  ...getPageListFilter(pageFilterOptions),
                  saveStatus: 'SAVED'
                }}
                buttonOptions={{markRead: false}}
                filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
      />
    </MainContainer>
  )
};

export default MyList;
