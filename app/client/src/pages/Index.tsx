import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import navLabels from "../components/Navigation/shared/NavLabels";
import React, {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";
import {getPageListFilter} from "../domain/utils";
import { useTranslation } from "react-i18next";


const Index = () => {
  const { t } = useTranslation(['page']);
  const [pageFilterOptions, setPageFilterOptions] = useState<PageFilterOptions>({
    defaultSortValue: 'LAST_READ_AT',
    sortFields: [{
      value: 'LAST_READ_AT',
      label: t('page:sortByLastRead')
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
