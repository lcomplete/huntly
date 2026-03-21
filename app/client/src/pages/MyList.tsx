import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import navLabels from "../components/Navigation/shared/NavLabels";
import {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";
import {getPageListFilter} from "../domain/utils";
import { useTranslation } from "react-i18next";

const MyList = () => {
  const { t } = useTranslation(['page']);
  const [pageFilterOptions, setPageFilterOptions] = useState<PageFilterOptions>({
    defaultSortValue: 'SAVED_AT',
    sortFields: [{
      value: 'SAVED_AT',
      label: t('page:sortBySaved')
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
      <PageList navLabel={navLabels.myList}
                filters={{
                  ...getPageListFilter(pageFilterOptions),
                  saveStatus: 'SAVED'
                }}
                buttonOptions={{markRead: false}}
                filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
                defaultSearchKeywords={['list']}
      />
    </MainContainer>
  )
};

export default MyList;
