import {useSearchParams} from "react-router-dom";
import "../components/PageList.css";
import {InfiniteData, QueryClient, useInfiniteQuery, useQueryClient} from "@tanstack/react-query";
import {PageSearchResult, SearchControllerApiFactory, SearchQuery} from "../api";
import MainContainer from "../components/MainContainer";
import Loading from "../components/Loading";
import React, {useEffect, useState} from "react";
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
import navLabels from "../components/Navigation/shared/NavLabels";
import SearchIcon from "@mui/icons-material/Search";

export default function Search() {
  const {ref: inViewRef, inView} = useInView();
  const {enqueueSnackbar} = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q');
  const options = searchParams.get("op");
  const selectedPageId = safeInt(searchParams.get("p"));
  const hasSearchQuery = Boolean(q && q.trim().length > 0);
  const [draftQuery, setDraftQuery] = useState('');
  const [draftOptions, setDraftOptions] = useState<string[]>([]);
  const [focusSignal, setFocusSignal] = useState(0);

  // Quick search suggestions with their keywords
  const quickSearchSuggestions = [
    { label: 'title', keyword: 'title', description: 'Search in titles only' },
    { label: 'tweet', keyword: 'tweet', description: 'Twitter/X content' },
    { label: 'github', keyword: 'github', description: 'GitHub repositories' },
    { label: 'starred', keyword: 'starred', description: 'Your starred items' },
    { label: 'read later', keyword: 'later', description: 'Read later list' },
  ];

  const handleQuickSearch = (keyword: string) => {
    setDraftQuery('');
    setDraftOptions([keyword]);
    setFocusSignal((prev) => prev + 1);
  };

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
          width: 88,
          height: 88,
          borderRadius: '50%',
          bgcolor: 'rgba(59, 130, 246, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3.5,
          border: '1px solid rgba(59, 130, 246, 0.12)',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.08)',
        }}
      >
        <SearchIcon sx={{ fontSize: 42, color: '#3b82f6' }} />
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 600, color: '#1e293b', mb: 1.5, letterSpacing: '-0.01em' }}>
        Search everything in Huntly
      </Typography>
      <Typography variant="body1" sx={{ color: '#64748b', mb: 4.5, maxWidth: 480, lineHeight: 1.6, fontSize: '15px' }}>
        Find articles, tweets, highlights, feeds, and more across all your hunted content.
      </Typography>
      <Box sx={{ width: '100%', maxWidth: 800 }}>
        <SearchBox
          variant="large"
          value={draftQuery}
          onValueChange={setDraftQuery}
          selectedKeywords={draftOptions}
          onSelectedKeywordsChange={setDraftOptions}
          focusSignal={focusSignal}
        />
      </Box>
      <Box sx={{ mt: 5, color: '#94a3b8' }}>
        <Typography variant="body2" sx={{ mb: 1.5, fontSize: '13px', fontWeight: 500, color: '#64748b' }}>
          Try searching for:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', justifyContent: 'center' }}>
          {quickSearchSuggestions.map((suggestion) => (
            <Box
              key={suggestion.keyword}
              onClick={() => handleQuickSearch(suggestion.keyword)}
              sx={{
                px: 2.5,
                py: 0.75,
                bgcolor: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.1)',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#475569',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'rgba(59, 130, 246, 0.12)',
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                  color: '#1e40af',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
              }}
              title={suggestion.description}
            >
              {suggestion.label}
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
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3.5, px: 2 }}>
        <Box sx={{ width: '100%', maxWidth: 800 }}>
          <SearchBox variant="large" />
        </Box>
      </Box>

      {/* Results count */}
      {data?.pages && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 2.5,
              py: 0.75,
              borderRadius: '999px',
              bgcolor: 'rgba(148, 163, 184, 0.12)',
              border: '1px solid rgba(148, 163, 184, 0.28)',
              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.08)'
            }}
          >
            <Typography variant="body2" sx={{ color: '#334155', fontWeight: 600, fontSize: '13.5px' }}>
              {data.pages[0].totalHits.toLocaleString()} results
            </Typography>
            <Typography component="span" sx={{ ml: 1.5, color: '#94a3b8', fontWeight: 500, fontSize: '12.5px' }}>
              ({data.pages[0].costSeconds.toFixed(3)}s)
            </Typography>
          </Box>
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
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                {isFetchingNextPage ? (
                  <Loading />
                ) : hasNextPage ? (
                  <Button
                    variant="text"
                    ref={inViewRef}
                    sx={{
                      color: '#3b82f6',
                      fontWeight: 500,
                      '&:hover': {
                        bgcolor: 'rgba(59, 130, 246, 0.08)',
                      }
                    }}
                  >
                    Load More
                  </Button>
                ) : data.pages[0].totalHits > 0 ? (
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '13px' }}>
                    No more results
                  </Typography>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Typography variant="body1" sx={{ color: '#475569', fontWeight: 500, mb: 1 }}>
                      No results found for "{q}"
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '13.5px' }}>
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
