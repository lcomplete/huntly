import {PageFilterOptions} from "../components/PageFilters";
import {PageListFilter} from "../components/PageList";

export function getPageListFilter(filterOptions:PageFilterOptions) : PageListFilter{
  return {
    sort: filterOptions.defaultSortValue,
    asc: filterOptions.asc,
    contentFilterType: filterOptions.contentFilterType,
    startDate: filterOptions.startDate || undefined,
    endDate: filterOptions.endDate || undefined
  }
}