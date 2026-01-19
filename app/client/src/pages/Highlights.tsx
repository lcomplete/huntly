import React, { useCallback } from 'react';
import "../components/PageList.css";
import {
  Box,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Card,
  CardContent
} from '@mui/material';
// Removed unused imports
import { alpha } from '@mui/material/styles';
import { useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { PageHighlightControllerApiFactory, HighlightListItem } from '../api';
import { useSnackbar } from 'notistack';
import SmartMoment from '../components/SmartMoment';
import Loading from '../components/Loading';
import SubHeader from '../components/SubHeader';
import navLabels from '../components/Navigation/shared/NavLabels';
import PageDetailModal from '../components/PageDetailModal';
import { setDocTitle } from '../common/docUtils';
import { useSearchParams, Link } from 'react-router-dom';
import { safeInt } from '../common/typeUtils';
import { PageOperateEvent } from '../components/PageOperationButtons';
import MainContainer from '../components/MainContainer';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog';

const renderHighlightedText = (text?: string | null) => {
  if (!text) {
    return null;
  }

  return text.split(/\n/).map((line, index) => (
    <React.Fragment key={index}>
      {index > 0 && <br />}
      {line}
    </React.Fragment>
  ));
};

const HighlightItem = React.memo(({
  highlight,
  onPageSelect,
  onDelete
}: {
  highlight: HighlightListItem;
  onPageSelect?: (event: React.MouseEvent<HTMLElement>, pageId: number, highlightId?: number) => void;
  onDelete?: (highlightId: number) => void;
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const handleHighlightClick = (e: React.MouseEvent<HTMLElement>) => {
    // 右键点击时不处理，让默认行为生效（显示右键菜单）
    if (e.button === 2) {
      return;
    }
    // 如果点击的是一个链接，则不触发卡片点击（不阻止链接的事件）
    const target = e.target as HTMLElement;
    if (target.closest('a') || target.closest('button')) {
      return;
    }
    if (onPageSelect) {
      onPageSelect(e, highlight.pageId, highlight.id);
    }
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // 右键点击时不处理，让默认行为生效（显示右键菜单）
    if (e.button === 2) {
      return;
    }
    // 左键点击时阻止默认行为，通过 onPageSelect 处理
    if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (onPageSelect) {
        onPageSelect(e, highlight.pageId, highlight.id);
      }
    }
    // 中键点击或 Ctrl/Cmd+左键点击时，允许默认行为（新窗口打开）
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (onDelete) {
      onDelete(highlight.id);
    }
    setDeleteDialogOpen(false);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  return (
    <Card
      sx={{
        mb: 2,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        border: theme => `1px solid ${theme.palette.divider}`,
        outline: 'none',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 3,
          borderColor: theme => theme.palette.warning.main
        },
        '&:focus-visible': {
          boxShadow: theme => `0 0 0 3px ${alpha(theme.palette.warning.main, 0.25)}`,
          borderColor: theme => theme.palette.warning.main
        }
      }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleHighlightClick(e as any);
        }
      }}
      onClick={handleHighlightClick}
      onMouseDown={handleHighlightClick}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        {/* 高亮内容 - 主要内容 */}
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderLeft: theme => `3px solid ${theme.palette.warning.main}`,
              borderRadius: 1,
              backgroundColor: theme => alpha(theme.palette.warning.main, theme.palette.mode === 'light' ? 0.08 : 0.16),
              display: 'block'
            }}
          >
            <Link
              to={`/page/${highlight.pageId}?h=${highlight.id}`}
              onClick={handleLinkClick}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontSize: '1rem',
                  lineHeight: 1.55,
                  fontWeight: 600,
                  color: 'text.primary',
                  wordBreak: 'break-word',
                  flex: 1,
                  display: '-webkit-box',
                  WebkitLineClamp: 20,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {renderHighlightedText(highlight.highlightedText)}
              </Typography>
            </Link>
          </Box>
        </Box>

        {/* 分隔线 */}
        <Box sx={{
          borderBottom: theme => `1px solid ${theme.palette.divider}`,
          mb: 2
        }} />

        {/* 文章信息 - 次要内容（与 MagazineItem 对齐：原文链接 + 时间 | 右侧 Delete） */}
        <Box sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 2 }
        }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            minWidth: 0,
            width: { xs: '100%', sm: 'auto' },
            flexWrap: { xs: 'wrap', sm: 'nowrap' }
          }}>
            <Typography
              component="a"
              href={highlight.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: { xs: '0.8rem', sm: '0.9rem' },
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: { xs: '100%', sm: 420 },
                textDecoration: 'none',
                cursor: 'pointer',
                '&:hover': {
                  textDecoration: 'underline'
                }
              }}
            >
              {highlight.pageTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" component="span" sx={{ mx: 1, display: { xs: 'none', sm: 'inline' } }}>·</Typography>
            <Typography variant="body2" color="text.secondary" component="span" sx={{
              fontSize: { xs: '0.75rem', sm: '0.9rem' },
              display: { xs: 'none', sm: 'inline' }
            }}>
              <SmartMoment dt={highlight.createdAt} />
            </Typography>
          </Box>

          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: { xs: 'space-between', sm: 'flex-end' },
            width: { xs: '100%', sm: 'auto' },
            gap: 1
          }}>
            {/* 移动端显示时间 */}
            <Typography variant="body2" color="text.secondary" component="span" sx={{
              fontSize: '0.75rem',
              display: { xs: 'inline', sm: 'none' }
            }}>
              <SmartMoment dt={highlight.createdAt} />
            </Typography>
            <Button
              variant="text"
              size="small"
              onClick={handleDeleteClick}
              sx={{
                color: 'text.secondary',
                fontSize: '0.75rem',
                minWidth: 'auto',
                px: 1,
                py: 0.25,
                '&:hover': {
                  color: 'error.main',
                  backgroundColor: theme => alpha(theme.palette.error.main, 0.08)
                }
              }}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </CardContent>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        title="Are you sure you want to delete this highlight?"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </Card>
  );
});

const Highlights: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const selectedPageId = safeInt(params.get("p"));

  const { ref: inViewRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteQuery(
  ['highlights'],
    async ({ pageParam = 0 }) => {
      const response = await PageHighlightControllerApiFactory().getHighlightListUsingGET(
        'desc',
        undefined,
        pageParam,
        20,
        'created_at'
      );
      return response.data.data;
    },
    {
      getNextPageParam: (lastPage) => {
        if (lastPage && !lastPage.last) {
          return lastPage.number + 1;
        }
        return undefined;
      },
      refetchOnWindowFocus: false,
      keepPreviousData: true
    }
  );

  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && !isLoading) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  React.useEffect(() => {
    setDocTitle('My Highlights');
  }, []);

  React.useEffect(() => {
    if (selectedPageId === 0) {
      setDocTitle('My Highlights');
    }
  }, [selectedPageId]);

  const allHighlights = data?.pages.flatMap(page => page?.content || []) || [];
  const totalCount = data?.pages[0]?.totalElements || 0;

  // Page detail functions
  const closePageDetail = () => {
    setParams({}, { preventScrollReset: true });
  };

  const openPageDetail = (e: React.MouseEvent<HTMLElement>, pageId: number, highlightId?: number) => {
    if (e.ctrlKey || e.metaKey) {
      return;
    }
    e.preventDefault();
    const params: any = { p: pageId.toString() };
    if (highlightId) {
      params.h = highlightId.toString();
    }
    setParams(params, { preventScrollReset: true });
  };

  const operateSuccess = (event: PageOperateEvent) => {
    // Handle page operation success if needed
    console.log('Page operation:', event);
  };

  // Delete highlight mutation
  const deleteHighlightMutation = useMutation(
    (highlightId: number) => PageHighlightControllerApiFactory().deleteHighlightUsingDELETE(highlightId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['highlights']);
        enqueueSnackbar('Highlight deleted.', {
          variant: "success",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      },
      onError: (error) => {
        console.error('Failed to delete highlight:', error);
        enqueueSnackbar('Failed to delete highlight. Please try again.', {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      }
    }
  );

  const handleDeleteHighlight = useCallback((highlightId: number) => {
    deleteHighlightMutation.mutate(highlightId);
  }, [deleteHighlightMutation]);

  return (
    <MainContainer>
      <PageDetailModal selectedPageId={selectedPageId} operateSuccess={operateSuccess} onClose={closePageDetail} />
      <SubHeader
        navLabel={navLabels.highlights}
        buttonOptions={{ markRead: false, viewSwitch: false }}
        defaultSearchKeywords={['highlights']}
        navLabelArea={
          totalCount > 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1, fontSize: '0.875rem' }}>
              ({totalCount})
            </Typography>
          ) : null
        }
      />

      <div className="flex flex-auto justify-center mt-2">
        <div className="p-2 sm:p-2 px-3 flex flex-col grow items-center">
          <div className="page-list w-full max-w-[720px] flex flex-col items-center mx-auto">
            {isLoading && <Loading />}
            {error && (
              <div className="w-full">
                <Alert severity="error">
                  Failed to load highlights. Please try again.
                </Alert>
              </div>
            )}
            {!isLoading && !error && data && (
              allHighlights.length === 0 ? (
                <div className="w-full">
                  <Alert severity="info">
                    <AlertTitle>No highlights found</AlertTitle>
                    <div>
                      You haven't highlighted any text yet. Start reading articles and highlight interesting passages to build your collection.
                    </div>
                  </Alert>
                </div>
              ) : (
                <>
                  {allHighlights.map((highlight) => (
                    <div className="w-full" key={highlight.id}>
                      <HighlightItem
                        highlight={highlight}
                        onPageSelect={openPageDetail}
                        onDelete={handleDeleteHighlight}
                      />
                    </div>
                  ))}
                  <div className="mt-3 mb-3">
                    {isFetchingNextPage && <Loading />}
                    {!isFetchingNextPage && hasNextPage && (
                      <Button variant="text" ref={inViewRef}>
                        Load More
                      </Button>
                    )}
                    {!isFetchingNextPage && !hasNextPage && allHighlights.length > 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                        No more highlights to load
                      </Typography>
                    )}
                  </div>
                </>
              )
            )}
          </div>
        </div>
      </div>
      
    </MainContainer>
  );
};

export default Highlights;
