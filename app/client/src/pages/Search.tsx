import {useSearchParams} from "react-router-dom";
import "../components/PageList.css";
import {InfiniteData, QueryClient, useInfiniteQuery, useQueryClient} from "@tanstack/react-query";
import {PageSearchResult, SearchControllerApiFactory, SearchQuery} from "../api";
import MainContainer from "../components/MainContainer";
import Loading from "../components/Loading";
import React, {useEffect} from "react";
import MagazineItem from "../components/MagazineItem";
import {Box, Button, Typography} from "@mui/material";
import {useInView} from "react-intersection-observer";
import {setDocTitle} from "../common/docUtils";
import PageDetailModal from "../components/PageDetailModal";
import {PageQueryKey} from "../domain/pageQueryKey";
import {PageOperateEvent, PageOperation} from "../components/PageOperationButtons";
import {useSnackbar} from "notistack";
import {safeInt} from "../common/typeUtils";
import SearchBox from "../components/SearchBox";
import SubHeader from "../components/SubHeader";
import navLabels from "../components/Sidebar/NavLabels";
import SearchIcon from "@mui/icons-material/Search";

export default function Search() {
  const {ref: inViewRef, inView} = useInView();
  const {enqueueSnackbar} = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q');
  const options = searchParams.get("op");
  const selectedPageId = safeInt(searchParams.get("p"));
  const hasSearchQuery = Boolean(q && q.trim().length > 0);

  useEffect(() => {
    if (hasSearchQuery) {
      setDocTitle(q + " - Search");
    } else {
      setDocTitle("Search");
    }
  }, [q, hasSearchQuery]);

  const query: SearchQuery = {q, size: 10, queryOptions: options};
  const queryKey = [PageQueryKey.Search, query];
  const queryClient = useQueryClient();

  const {
    isLoading,
    data,
    error,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery(queryKey,
    async ({pageParam}) => (await SearchControllerApiFactory().searchPagesUsingPOST({
        ...query,
        page: pageParam || 1
      }
    )).data,
    {
      enabled: hasSearchQuery,
      getPreviousPageParam: (firstPage) => firstPage.page - 1,
      getNextPageParam: (lastPage) => lastPage.items.length > 0 ? lastPage.page + 1 : undefined,
    }
  );

  useEffect(() => {
    if (inView && !isLoading && !isFetchingNextPage && hasSearchQuery) {
      fetchNextPage();
    }
  }, [inView, isLoading, isFetchingNextPage, fetchNextPage, hasSearchQuery]);

  function openPageDetail(e: React.MouseEvent, pageId: number) {
    if (e.ctrlKey || e.metaKey) {
      return;
    }
    e.preventDefault();
    setSearchParams({q: q || '', op: options || '', p: String(pageId)}, {preventScrollReset: true});
  }

  function closePageDetail() {
    setSearchParams({q: q || '', op: options || ''}, {preventScrollReset: true});
  }

  function operateSuccess(event: PageOperateEvent) {
    updatePageListQueryData(event, queryClient, queryKey);
  }

  function updatePageListQueryData(event: PageOperateEvent, client: QueryClient, key: typeof queryKey) {
    if (event.operation !== PageOperation.delete) {
      const res = event.result;
      client.setQueryData<InfiniteData<PageSearchResult>>(key, oldData => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map(page => ({
            ...page,
            items: page.items.map(rawPage => rawPage.id === event.rawPageStatus.id ? {
              ...rawPage,
              starred: res.starred,
              readLater: res.readLater,
              librarySaveStatus: res.librarySaveStatus
            } : rawPage)
          }))
        };
      });
    } else {
      client.setQueryData<InfiniteData<PageSearchResult>>(key, oldData => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map(page => ({
            ...page,
            items: page.items.filter(curPage => curPage.id !== event.rawPageStatus.id)
          }))
        };
      });
      closePageDetail();
      enqueueSnackbar('Page deleted.', {
        variant: "success",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    }
  }

  // Empty state - no search query
  const renderEmptyState = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        px: 3,
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          bgcolor: 'rgba(14, 165, 233, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
        }}
      >
        <SearchIcon sx={{ fontSize: 40, color: '#0ea5e9' }} />
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 600, color: '#374151', mb: 1.5 }}>
        Search your library
      </Typography>
      <Typography variant="body1" sx={{ color: '#6b7280', mb: 4, maxWidth: 400 }}>
        Find articles, tweets, highlights, and more across your entire collection.
      </Typography>
      <Box sx={{ width: '100%', maxWidth: 600 }}>
        <SearchBox />
      </Box>
      <Box sx={{ mt: 4, color: '#9ca3af' }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Try searching for:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['author:', 'url:', 'tweet', 'github', 'feeds'].map((term) => (
            <Box
              key={term}
              sx={{
                px: 2,
                py: 0.5,
                bgcolor: '#f3f4f6',
                borderRadius: '16px',
                fontSize: '13px',
                color: '#6b7280',
              }}
            >
              {term}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );

  // Search results view
  const renderResults = () => (
    <>
      {/* Search Box at top */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, px: 2 }}>
        <Box sx={{ width: '100%', maxWidth: 720 }}>
          <SearchBox />
        </Box>
      </Box>

      {/* Results count */}
      {data?.pages && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Typography variant="body2" sx={{ color: '#6b7280' }}>
            {data.pages[0].totalHits} results
            <Typography component="span" sx={{ ml: 1, color: '#9ca3af' }}>
              ({data.pages[0].costSeconds.toFixed(3)}s)
            </Typography>
          </Typography>
        </Box>
      )}

      {/* Results list */}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ width: '100%', maxWidth: 720 }}>
          {isLoading && <Loading />}
          {error && (
            <Typography color="error" sx={{ textAlign: 'center', py: 4 }}>
              Oops, something went wrong. Please try again.
            </Typography>
          )}
          {!isLoading && !error && data && (
            <>
              {data.pages.map((pageData, index) => (
                <React.Fragment key={index}>
                  {pageData.items.map((page) => (
                    <MagazineItem
                      page={page}
                      key={page.id}
                      onPageSelect={openPageDetail}
                      onOperateSuccess={operateSuccess}
                    />
                  ))}
                </React.Fragment>
              ))}
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                {isFetchingNextPage ? (
                  <Loading />
                ) : hasNextPage ? (
                  <Button variant="text" ref={inViewRef}>
                    Load More
                  </Button>
                ) : data.pages[0].totalHits > 0 ? (
                  <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                    No more results
                  </Typography>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" sx={{ color: '#6b7280' }}>
                      No results found for "{q}"
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#9ca3af', mt: 1 }}>
                      Try adjusting your search terms
                    </Typography>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>
      </Box>
    </>
  );

  return (
    <MainContainer>
      <PageDetailModal
        selectedPageId={selectedPageId}
        operateSuccess={operateSuccess}
        onClose={closePageDetail}
      />
      <SubHeader
        navLabel={navLabels.search}
        buttonOptions={{ markRead: false, viewSwitch: false }}
      />
      <Box sx={{ pt: 3 }}>
        {hasSearchQuery ? renderResults() : renderEmptyState()}
      </Box>
    </MainContainer>
  );
}
