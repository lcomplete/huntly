import {useSearchParams} from "react-router-dom";
import {InfiniteData, QueryClient, useInfiniteQuery, useQueryClient} from "@tanstack/react-query";
import {PageSearchResult, SearchControllerApiFactory, SearchQuery} from "../api";
import MainContainer from "../components/MainContainer";
import Loading from "../components/Loading";
import React, {useEffect, useState} from "react";
import MagazineItem from "../components/MagazineItem";
import {Button} from "@mui/material";
import {useInView} from "react-intersection-observer";
import {setDocTitle} from "../common/docUtils";
import PageDetailModal from "../components/PageDetailModal";
import {PageQueryKey} from "../domain/pageQueryKey";
import {PageOperateEvent, PageOperation} from "../components/PageOperationButtons";
import {useSnackbar} from "notistack";

// type SearchQuery = {
//   page?: number, q?: string, queryOptions?: string, size?: number
// }

export default function Search() {
  setDocTitle("Search results");

  const {ref: inViewRef, inView} = useInView();
  const {enqueueSnackbar} = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q');
  const options = searchParams.get("op");
  setDocTitle(q + " - search results");

  const [selectedPageId, setSelectedPageId] = useState(0);
  useEffect(() => {
    setSelectedPageId(0);
  }, [q, options]);

  const query: SearchQuery = {q, size: 10, queryOptions: options};
  const queryKey = [PageQueryKey.Search, query];
  const queryClient = useQueryClient();

  const {
    isLoading,
    status,
    data,
    error,
    isFetching,
    isFetchingNextPage,
    isFetchingPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
  } = useInfiniteQuery(queryKey,
    async ({pageParam}) => (await SearchControllerApiFactory().searchPagesUsingPOST({
        ...query,
        page: pageParam || 1
      }
    )).data,
    {
      getPreviousPageParam: (firstPage) => firstPage.page - 1,
      getNextPageParam: (lastPage) => lastPage.items.length > 0 ? lastPage.page + 1 : undefined,
    }
  );

  useEffect(() => {
    if (inView && !isLoading && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView]);

  function openPageDetail(e, pageId) {
    if (e.ctrlKey || e.metaKey) {
      return;
    }
    e.preventDefault();
    setSelectedPageId(pageId);
  }

  function operateSuccess(event: PageOperateEvent) {
    updatePageListQueryData(event, queryClient, queryKey);
  }

  function updatePageListQueryData(event: PageOperateEvent, queryClient: QueryClient, queryKey) {
    if (event.operation !== PageOperation.delete) {
      const res = event.result;
      queryClient.setQueryData<InfiniteData<PageSearchResult>>(queryKey, oldData => ({
        ...oldData,
        pages: oldData.pages.map(page => {
          return {
            ...page,
            items: page.items.map(rawPage => rawPage.id === event.rawPageStatus.id ? {
              ...rawPage,
              starred: res.starred,
              readLater: res.readLater,
              librarySaveStatus: res.librarySaveStatus
            } : rawPage)
          }
        })
      }));
    } else {
      queryClient.setQueryData<InfiniteData<PageSearchResult>>(queryKey, oldData => ({
        ...oldData,
        pages: oldData.pages.map(page => {
          return {
            ...page,
            items: page.items.filter(curPage => curPage.id !== event.rawPageStatus.id)
          };
        })
      }));
      closePageDetail();
      enqueueSnackbar('Page deleted.', {
        variant: "success",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    }
  }

  function closePageDetail() {
    setSelectedPageId(0);
  }

  return <MainContainer>
    <PageDetailModal selectedPageId={selectedPageId} operateSuccess={operateSuccess} onClose={closePageDetail}/>
    <div className="p-2">
      {
        data && data.pages && <div className={'border-0 border-solid border-b-2 border-gray-100 flex'}>
              <div className={'grow'}></div>
              <div className={'p-0 m-2 text-gray-500'}>{data.pages[0].totalHits} search
                  results <span>({data.pages[0].costSeconds.toFixed(3)} seconds)</span></div>
          </div>
      }

      <div className={'flex flex-auto'}>
        <div className="p-2 flex flex-col grow items-center">
          <div className={'page-list w-[720px] flex flex-col items-center'}>
            {isLoading && <Loading/>}
            {error && <p>Oops, something was broken.</p>}
            {!isLoading && !error && data &&
                <>
                  {data.pages.map((pages, index) =>
                    <React.Fragment key={index}>
                      {pages.items.map((page) =>
                        <MagazineItem page={page} key={page.id} onPageSelect={openPageDetail}
                                      onOperateSuccess={operateSuccess}></MagazineItem>
                      )}
                    </React.Fragment>
                  )}
                    <div className={"mt-3 mb-3"}>
                      {isFetchingNextPage
                        ? <Loading/>
                        : hasNextPage
                          ? <Button variant="text" ref={inViewRef}>Load More</Button>
                          : <div></div>
                      }
                    </div>
                </>
            }
          </div>
        </div>

        <div className={'filter-options w-[270px] sticky mt-3 top-28 self-start'}>
        </div>
      </div>

    </div>
  </MainContainer>;
}