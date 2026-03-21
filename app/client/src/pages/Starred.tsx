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
    defaultSortValue: 'STARRED_AT',
    sortFields: [{
      value: 'STARRED_AT',
      label: t('page:sortByStarred')
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
      <PageList navLabel={navLabels.starred}
                filters={{
                  ...getPageListFilter(pageFilterOptions),
                  saveStatus: 'SAVED',
                  starred: true
                }}
                buttonOptions={{markRead: false}}
                filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
                defaultSearchKeywords={['starred']}
      />
    </MainContainer>
  )
};

export default MyList;
