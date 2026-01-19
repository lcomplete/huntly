import PageList from "../components/PageList";
import navLabels from "../components/Navigation/shared/NavLabels";
import MainContainer from "../components/MainContainer";
import {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";
import {getPageListFilter} from "../domain/utils";
import {useSearchParams} from "react-router-dom";
import {ContentType, SORT_VALUE} from "../model";

export default function Twitter() {
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
      label: 'Recently read'
    }, {
      value: 'VOTE_SCORE',
      label: 'Most popular'
    }, {
      value: 'CONNECTED_AT',
      label: 'Recently tweeted'
    }, {
      value: 'CREATED_AT',
      label: 'Recently hunted'
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