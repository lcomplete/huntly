import React from 'react';
import {
  Box,
  Typography,
  Button
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { PageHighlightDto, PageHighlightControllerApiFactory } from '../../api';
import SmartMoment from '../SmartMoment';
import DeleteConfirmDialog from '../DeleteConfirmDialog';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

interface PageHighlightListProps {
  highlights: PageHighlightDto[];
  onHighlightClick?: (highlight: PageHighlightDto) => void;
  onHighlightDeleted?: () => void;
}

const PageHighlightList: React.FC<PageHighlightListProps> = ({
  highlights,
  onHighlightClick,
  onHighlightDeleted
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [highlightToDelete, setHighlightToDelete] = React.useState<number | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  // Delete highlight mutation
  const deleteHighlightMutation = useMutation(
    (highlightId: number) => PageHighlightControllerApiFactory().deleteHighlightUsingDELETE(highlightId),
    {
      onSuccess: () => {
        if (onHighlightDeleted) {
          onHighlightDeleted();
        }
        enqueueSnackbar('Highlight deleted.', {
          variant: "success",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
        setDeleteDialogOpen(false);
        setHighlightToDelete(null);
      },
      onError: (error) => {
        console.error('Failed to delete highlight:', error);
        enqueueSnackbar('Failed to delete highlight. Please try again.', {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
        setDeleteDialogOpen(false);
        setHighlightToDelete(null);
      }
    }
  );

  if (!highlights.length) {
    return null;
  }

  // Always show all highlights for compact list
  const visibleHighlights = highlights;

  const handleHighlightClick = (highlight: PageHighlightDto) => {
    if (onHighlightClick) {
      onHighlightClick(highlight);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, highlightId: number) => {
    e.stopPropagation();
    setHighlightToDelete(highlightId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (highlightToDelete !== null) {
      deleteHighlightMutation.mutate(highlightToDelete);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setHighlightToDelete(null);
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="subtitle2"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          fontWeight: 600,
          color: 'text.primary',
          fontSize: '0.9rem',
          mb: 1.5,
          px: 2
        }}
      >
        <FormatQuoteIcon fontSize="small" sx={{ fontSize: '1.1rem', color: '#f59e0b' }} />
        Highlights ({highlights.length})
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {visibleHighlights.map((highlight) => (
          <Box
            key={highlight.id}
            sx={{
              cursor: 'pointer',
              p: 1.5,
              border: theme => `1px solid ${alpha(theme.palette.divider, 0.12)}`,
              borderRadius: 1.5,
              transition: 'all 0.2s ease',
              position: 'relative',
              '&:hover': {
                borderColor: theme => alpha(theme.palette.warning.main, 0.3),
                boxShadow: theme => `0 2px 8px ${alpha(theme.palette.common.black, 0.04)}`
              },
            }}
            onClick={() => handleHighlightClick(highlight)}
          >
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                borderLeft: theme => `3px solid ${theme.palette.warning.main}`,
                borderRadius: 1,
                backgroundColor: theme => alpha(theme.palette.warning.main, theme.palette.mode === 'light' ? 0.08 : 0.16),
                mb: 1,
                ml: 1
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  color: 'text.primary',
                  fontWeight: 500,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {highlight.highlightedText}
              </Typography>
            </Box>

            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pl: 1
            }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.8rem' }}
              >
                <SmartMoment dt={highlight.createdAt} />
              </Typography>

              <Button
                variant="text"
                size="small"
                onClick={(e) => highlight.id && handleDeleteClick(e, highlight.id)}
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
        ))}
      </Box>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        title="Are you sure you want to delete this highlight?"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </Box>
  );
};

export default PageHighlightList;