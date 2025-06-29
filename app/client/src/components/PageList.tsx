import MagazineItem from "../components/MagazineItem";
import {ApiResultOfint, PageControllerApiFactory, PageItem} from "../api";
import {InfiniteData, QueryClient, useInfiniteQuery, useQueryClient} from "@tanstack/react-query";
import {useInView} from "react-intersection-observer";
import React, {ReactElement, useEffect, useState, useRef, useCallback} from "react";
import {AlertTitle, Button} from "@mui/material";
import Loading from "./Loading";
import {NavLabel} from "./Sidebar/NavLabels";
import SubHeader, {ButtonOptions} from "./SubHeader";
import {PageOperateEvent, PageOperation} from "./PageOperationButtons";
import {PageQueryKey} from "../domain/pageQueryKey";
import {useSnackbar} from "notistack";
import {AxiosPromise, AxiosResponse} from "axios";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TransitionAlert from "./common/TransitionAlert";
import {isDeepEqual} from "../common/objectUtils";
import {setDocTitle} from "../common/docUtils";
import {useSearchParams} from "react-router-dom";
import {safeInt} from "../common/typeUtils";
import {ContentType, SORT_VALUE} from "../model";
import PageDetailModal from "./PageDetailModal";
import Alert from "@mui/material/Alert";
import { useGlobalSettings } from "../contexts/GlobalSettingsContext";

export type PageListFilter = {
  asc?: boolean,
  connectorId?: number,
  connectorType?: number,
  count?: number,
  firstRecordDate?: string,
  folderId?: number;
  lastRecordDate?: string,
  readLater?: boolean,
  saveStatus?: 'ARCHIVED' | 'NOT_SAVED' | 'SAVED',
  sort?: SORT_VALUE,
  contentType?: ContentType,
  sourceId?: number,
  starred?: boolean,
  markRead?: boolean,
  contentFilterType?: number,
  startDate?: string,
  endDate?: string,
}

interface PageListProps {
  filters?: PageListFilter
  navLabel?: NavLabel,
  navLabelArea?: ReactElement,
  onMarkAllAsRead?: () => AxiosPromise<ApiResultOfint>,
  buttonOptions?: ButtonOptions,
  showMarkReadOption?: boolean,
  hasMarkReadOnScrollFeature?: boolean,
  filterComponent?: React.ReactElement
}

const PageList = (props: PageListProps) => {
  const {
    buttonOptions,
    navLabel,
    navLabelArea,
    onMarkAllAsRead,
    showMarkReadOption,
    hasMarkReadOnScrollFeature
  } = props;
  const {ref: inViewRef, inView} = useInView();
  const {enqueueSnackbar} = useSnackbar();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { markReadOnScroll } = useGlobalSettings();

  const selectedPageId = safeInt(params.get("p"));
  const propFilters = props.filters || {};
  const [filters, setFilters] = useState<PageListFilter>(propFilters);
  const [showDoneTip, setShowDoneTip] = useState(false);
  const [lastVisitPageId, setLastVisitPageId] = useState(0);
  const pageSize = filters.count || 20;
  const queryKey = [PageQueryKey.PageList, filters];
  
  // Scroll tracking state - tracks which pages have been marked as read
  const [processedPages, setProcessedPages] = useState<Set<number>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pageListRef = useRef<HTMLDivElement | null>(null);
  const observedElementsRef = useRef<Set<Element>>(new Set());

  // Only enable scroll tracking if the feature is enabled for this page and the setting is on
  const shouldEnableScrollTracking = hasMarkReadOnScrollFeature && markReadOnScroll;

  // Mark pages as read via API
  const markPagesAsRead = useCallback((pageIds: number[]) => {
    if (pageIds.length === 0) return;

    PageControllerApiFactory().markReadByPageIdsUsingPOST(pageIds).then((res) => {
      if (res && res.data && res.data.code === 0) {
        // Update query data to reflect the change
        queryClient.setQueryData<InfiniteData<PageItem[]>>(queryKey, oldData => ({
          ...oldData,
          pages: oldData.pages.map(pages => pages.map((rawPage): PageItem => 
            pageIds.includes(rawPage.id) ? { ...rawPage, markRead: true } : rawPage
          ))
        }));
      }
    }).catch(err => {
      console.error('Failed to mark pages as read:', err);
    });
  }, [queryKey, queryClient]);

  // Mark pages as read when they scroll past (become invisible from top)
  const markPageAsReadOnScroll = useCallback((pageId: number) => {
    // Skip if already processed
    if (processedPages.has(pageId)) return;
    
    // Check if page exists and is not already marked as read
    const queryData = queryClient.getQueryData<InfiniteData<PageItem[]>>(queryKey);
    const page = queryData?.pages?.flat().find(p => p.id === pageId);
    
    if (page && !page.markRead) {
      // Mark as processed to avoid duplicate calls
      setProcessedPages(prev => {
        const newProcessed = new Set(prev);
        newProcessed.add(pageId);
        return newProcessed;
      });
      
      // Call API to mark as read
      markPagesAsRead([pageId]);
    }
  }, [processedPages, queryClient, queryKey, markPagesAsRead]);

  // Initialize Intersection Observer for scroll tracking
  useEffect(() => {
    if (!shouldEnableScrollTracking) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageId = parseInt(entry.target.getAttribute('data-page-id') || '0');
          if (pageId === 0) return;

          // When element scrolls out of view going downward (scrolled past), mark as read
          // This is the simple "mark read when scrolling down past them" behavior
          if (!entry.isIntersecting && entry.boundingClientRect.bottom < entry.rootBounds.top) {
            markPageAsReadOnScroll(pageId);
          }
        });
      },
      {
        rootMargin: '-90px 0px 0px 0px',
        threshold: 0
      }
    );

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observedElementsRef.current.clear();
      }
    };
  }, [shouldEnableScrollTracking, markPageAsReadOnScroll]);

  // Observe all page items when data changes (moved to after data declaration)
  const observePageItems = useCallback(() => {
    if (!shouldEnableScrollTracking || !observerRef.current || !pageListRef.current) return;

    // Find all page items and observe only new ones
    const pageItems = pageListRef.current.querySelectorAll('[data-page-id]');
    pageItems.forEach((item) => {
      // Only observe if not already observed
      if (observerRef.current && !observedElementsRef.current.has(item)) {
        observerRef.current.observe(item);
        observedElementsRef.current.add(item);
      }
    });
  }, [shouldEnableScrollTracking]);

  // Clean up observed elements that are no longer in DOM
  const cleanupObservedElements = useCallback(() => {
    if (!pageListRef.current) return;
    
    const currentElements = new Set(pageListRef.current.querySelectorAll('[data-page-id]'));
    const elementsToRemove: Element[] = [];
    
    observedElementsRef.current.forEach((element) => {
      if (!currentElements.has(element) || !element.isConnected) {
        elementsToRemove.push(element);
      }
    });
    
    elementsToRemove.forEach((element) => {
      if (observerRef.current) {
        observerRef.current.unobserve(element);
      }
      observedElementsRef.current.delete(element);
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

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
    remove,
    refetch
  } = useInfiniteQuery(
    queryKey,
    async ({
             pageParam = {
               lastRecordAt: undefined,
               firstRecordAt: undefined,
               firstVoteScore: undefined,
               lastVoteScore: undefined
             }
           }) => {
      const res = await PageControllerApiFactory().listPageItemsUsingGET(
        filters.asc,
        filters.connectorId,
        filters.connectorType,
        filters.contentFilterType,
        filters.contentType,
        pageSize,
        filters.endDate,
        pageParam.firstRecordAt || undefined,
        pageParam.firstVoteScore || undefined,
        filters.folderId,
        pageParam.lastRecordAt || undefined,
        pageParam.lastVoteScore || undefined,
        filters.markRead,
        filters.readLater,
        filters.saveStatus,
        filters.sort,
        filters.sourceId,
        filters.starred,
        filters.startDate
      );
      return res.data
    },
    {
      getPreviousPageParam: (firstPage) =>
        firstPage && firstPage.length > 0
          ? (filters.sort === 'VOTE_SCORE' ? {firstVoteScore: firstPage[0].voteScore} : {firstRecordAt: firstPage[0].recordAt})
          : {},
      getNextPageParam: (lastPage) =>
        lastPage && lastPage.length > 0 && lastPage.length >= pageSize
          ? (filters.sort === 'VOTE_SCORE' ? {lastVoteScore: lastPage[lastPage.length - 1].voteScore} : {lastRecordAt: lastPage[lastPage.length - 1].recordAt})
          : undefined,
    },
  );

  // if there is no un read pages, then load all pages
  if (filters.markRead === false && data && data.pages && (data.pages.length === 0 || data.pages[0].length === 0)) {
    setShowDoneTip(true);
    setFilters({...filters, markRead: undefined});
  }

  useEffect(() => {
    if (!isDeepEqual(filters, propFilters)) {
      setShowDoneTip(false);
      setFilters(propFilters);
    }
  }, [propFilters]);

  useEffect(() => {
    if (selectedPageId === 0) {
      setDocTitle(navLabel.labelText);
    } else {
      setLastVisitPageId(selectedPageId);
    }
  }, [selectedPageId, navLabel]);

  useEffect(() => {
    if (inView && !isLoading && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView]);

  // Observe page items when data is loaded
  useEffect(() => {
    if (data && data.pages && data.pages.length > 0) {
      // Clean up elements that are no longer in DOM first
      cleanupObservedElements();
      
      // Wait for DOM to update, then observe new items
      setTimeout(() => {
        observePageItems();
      }, 1000);
    }
  }, [data, observePageItems, cleanupObservedElements]);

  function operateSuccess(event: PageOperateEvent) {
    updatePageListQueryData(event, queryClient, queryKey);
  }

  function updatePageListQueryData(event: PageOperateEvent, queryClient: QueryClient, queryKey) {
    if (event.operation !== PageOperation.delete) {
      const res = event.result;
      queryClient.setQueryData<InfiniteData<PageItem[]>>(queryKey, oldData => ({
        ...oldData,
        pages: oldData.pages.map(pages => pages.map(rawPage => rawPage.id === event.rawPageStatus.id ? {
          ...rawPage,
          starred: res.starred,
          readLater: res.readLater,
          librarySaveStatus: res.librarySaveStatus
        } : rawPage))
      }));
    } else {
      queryClient.setQueryData<InfiniteData<PageItem[]>>(queryKey, oldData => ({
        ...oldData,
        pages: oldData.pages.map(pages => pages.filter(curPage => curPage.id !== event.rawPageStatus.id))
      }));
      closePageDetail();
      enqueueSnackbar('Page deleted.', {
        variant: "success",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    }
  }

  function markListAsRead() {
    const queryData = queryClient.getQueryData<InfiniteData<PageItem[]>>(queryKey);
    if (queryData && queryData.pages) {
      const pageIds = [];
      queryData.pages.forEach(p => {
        p.forEach(page => {
          if (!page.markRead) {
            pageIds.push(page.id);
          }
        })
      });

      PageControllerApiFactory().markReadByPageIdsUsingPOST(pageIds).then((res) => {
        handleMarkReadResult(res);
      });
    }
  }

  function handleMarkReadResult(res: AxiosResponse<ApiResultOfint>) {
    if (res && res.data && res.data.code === 0) {
      enqueueSnackbar('Marked ' + res.data.data + ' pages as read.', {
        variant: "success",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
      updateQueryDataMarkRead();
    }
  }

  function markAllAsRead() {
    onMarkAllAsRead().then(handleMarkReadResult);
  }

  function updateQueryDataMarkRead() {
    queryClient.setQueryData<InfiniteData<PageItem[]>>(queryKey, oldData => ({
      ...oldData,
      pages: oldData.pages.map(pages => pages.map((rawPage): PageItem => ({
        ...rawPage,
        markRead: true
      })))
    }));
  }

  function closePageDetail() {
    setParams({}, {preventScrollReset: true});
  }

  function openPageDetail(e, pageId) {
    if (e.ctrlKey || e.metaKey) {
      return;
    }
    e.preventDefault();
    setParams({p: pageId}, {preventScrollReset: true});
  }

  function refreshPages() {
    remove();
    refetch();
  }

  return (
    <>
      <PageDetailModal selectedPageId={selectedPageId} operateSuccess={operateSuccess} onClose={closePageDetail}/>
      <SubHeader navLabel={navLabel} onMarkListAsRead={markListAsRead} onMarkAllAsRead={markAllAsRead}
                 onRefresh={refreshPages} navLabelArea={navLabelArea}
                 buttonOptions={buttonOptions}/>
      <div className={'flex flex-auto'}>
        <div className="p-2 flex flex-col grow items-center">
          <div className={'page-list w-[720px] flex flex-col items-center'} ref={pageListRef}>
            {showDoneTip && <div className={'w-full'}>
                <TransitionAlert severity="success" color="info">
                    <AlertTitle>Well done!</AlertTitle>
                    There are no unread articles in this section.
                </TransitionAlert>
                <div className="separator pt-2 pb-2"><ExpandMoreIcon/> Older articles</div>
            </div>}
            {isLoading && <Loading/>}
            {error && <p>Oops, something was broken. <div>{error.toString()}</div></p>}
            {!isLoading && !error && data &&
                <>
                  {
                    (data.pages.length === 0 || data.pages[0].length === 0) && <div>
                          <Alert severity="info">
                              <div>
                                  You have arrived in the desert of information, go hunt some information.
                              </div>
                              <br/>
                              <div>
                                  If you haven't installed the browser plugin yet, you can download and install it here.
                              </div>
                              <br />
                              <div>
                                  <a href={'https://chrome.google.com/webstore/detail/huntly/cphlcmmpbdkadofgcedjgfblmiklbokm'}
                                     target={'_blank'} className={'text-blue-600 hover:underline'}>Web Store</a>
                              </div>
                          </Alert>
                      </div>
                  }
                  {data.pages.map((pages, index) =>
                    <React.Fragment key={index}>
                      {pages.map((page) => {
                          return <div 
                            className={`w-full`} 
                            key={page.id} 
                            data-page-id={!page.markRead ? page.id : undefined}
                          >
                            <MagazineItem page={page} showMarkReadOption={showMarkReadOption}
                                               onOperateSuccess={operateSuccess}
                                               currentVisit={lastVisitPageId === page.id}
                                               onPageSelect={(e, id) => openPageDetail(e, id)}></MagazineItem>
                          </div>;
                        }
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
          {props.filterComponent}
        </div>
      </div>
    </>
  );
};

export default PageList;
