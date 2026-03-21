import PageList from "../components/PageList";
import navLabels from "../components/Navigation/shared/NavLabels";
import MainContainer from "../components/MainContainer";
import {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";
import {getPageListFilter} from "../domain/utils";
import {useSearchParams} from "react-router-dom";
import {ContentType, SORT_VALUE} from "../model";
import { useTranslation } from "react-i18next";

export default function Twitter() {
  const { t } = useTranslation(['page']);
  const [searchParams] = useSearchParams();

  // Read URL parameters for hot tweets filtering
  const urlSort = searchParams.get("sort") as SORT_VALUE | null;
  const urlContentType = searchParams.get("contentType") as ContentType | null;
  const urlStartDate = searchParams.get("startDate");
  const urlEndDate = searchParams.get("endDate");

  const [pageFilterOptions, setPageFilterOptions] = useState<PageFilterOptions>(() => ({
    defaultSortValue: urlSort || 'LAST_READ_AT',
    sortFields: [{
      value: 'LAST_READ_AT',
      label: t('page:sortByLastRead')
    }, {
      value: 'VOTE_SCORE',
      label: t('page:sortByVoteScore')
    }, {
      value: 'CONNECTED_AT',
      label: t('page:sortByConnected')
    }, {
      value: 'CREATED_AT',
      label: t('page:sortByCreated')
    }],
    asc: false,
    hideContentTypeFilter: true,
    startDate: urlStartDate || undefined,
    endDate: urlEndDate || undefined
  }));

  function handleFilterChange(options: PageFilterOptions) {
    setPageFilterOptions(options);
  }

  return <MainContainer>
    <PageList navLabel={navLabels.twitter}
              filters={{
                ...getPageListFilter(pageFilterOptions),
                contentType: urlContentType || 'TWEET'
              }}
              buttonOptions={{markRead: false}}
              filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
              defaultSearchKeywords={['tweet']}/>
  </MainContainer>;
}