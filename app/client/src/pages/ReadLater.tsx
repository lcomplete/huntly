import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import navLabels from "../components/Navigation/shared/NavLabels";
import {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";
import {getPageListFilter} from "../domain/utils";

const MyList = () => {
  const [pageFilterOptions, setPageFilterOptions] = useState<PageFilterOptions>({
    defaultSortValue: 'READ_LATER_AT',
    sortFields: [{
      value: 'READ_LATER_AT',
      label: 'Recently saved'
    }],
    asc: false,
    includeArchived: false,
    includeArchivedOption: true
  })

  function handleFilterChange(options: PageFilterOptions) {
    setPageFilterOptions(options);
  }

  return (
    <MainContainer>
      <PageList navLabel={navLabels.readLater}
                filters={{
                  ...getPageListFilter(pageFilterOptions),
                  saveStatus: 'SAVED',
                  readLater: true
                }}
                buttonOptions={{markRead: false}}
                filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
                defaultSearchKeywords={['later']}
      />
    </MainContainer>
  )
};

export default MyList;
