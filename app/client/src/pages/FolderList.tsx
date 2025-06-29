import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import {useParams} from "react-router-dom";
import {safeInt} from "../common/typeUtils";
import {useQuery} from "@tanstack/react-query";
import {FolderControllerApiFactory, PageControllerApiFactory} from "../api";
import navLabels from "../components/Sidebar/NavLabels";
import {useState} from "react";
import PageFilters, {PageFilterOptions} from "../components/PageFilters";
import {getPageListFilter} from "../domain/utils";

const FolderList = () => {
  const {id} = useParams<"id">();
  
  const {
    isLoading,
    error,
    data: folder,
  } = useQuery(["folder_info", id], async () => (await FolderControllerApiFactory().getFolderByIdUsingGET(safeInt(id))).data);

  function markAllAsRead() {
    return PageControllerApiFactory().markReadByFolderIdUsingPOST(safeInt(id));
  }

  const [pageFilterOptions, setPageFilterOptions] = useState<PageFilterOptions>({
    defaultSortValue: 'CONNECTED_AT',
    sortFields: [{
      value: 'CONNECTED_AT',
      label: 'Recently connected'
    }],
    asc: false,
    hideContentTypeFilter: true,
    showAllArticles: false,
    showAllArticlesOption: true
  })

  function handleFilterChange(options: PageFilterOptions) {
    setPageFilterOptions(options);
  }

  return (
    <MainContainer>
      <PageList navLabel={{...navLabels.folder, labelText: folder ? folder.name : "", linkTo: '/folder/' + id}}
                filters={{
                  ...getPageListFilter(pageFilterOptions),
                  folderId: safeInt(id),
                  markRead: pageFilterOptions.showAllArticles ? undefined : false,
                }} onMarkAllAsRead={markAllAsRead}
                showMarkReadOption={true}
                hasMarkReadOnScrollFeature={true}
                filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange}/>}
      />
    </MainContainer>
  )
};

export default FolderList;
