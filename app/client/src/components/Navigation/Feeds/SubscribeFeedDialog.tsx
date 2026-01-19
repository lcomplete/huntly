import React, { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import SearchIcon from '@mui/icons-material/Search';
import { useSnackbar } from 'notistack';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { useQueryClient } from '@tanstack/react-query';
import { PreviewFeedsInfo, SettingControllerApiFactory } from '../../../api';

interface SubscribeFeedDialogProps {
  open: boolean;
  onClose: () => void;
}

const SubscribeFeedDialog: React.FC<SubscribeFeedDialogProps> = ({ open, onClose }) => {
  const [feedsInfo, setFeedsInfo] = useState<PreviewFeedsInfo | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [following, setFollowing] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const api = SettingControllerApiFactory();

  const formik = useFormik({
    initialValues: { subscribeUrl: '' },
    validationSchema: yup.object({
      subscribeUrl: yup.string().url('Must be a valid URL').required('RSS link is required.'),
    }),
    onSubmit: async (values) => {
      setPreviewing(true);
      setFeedsInfo(null);
      try {
        const res = await api.previewFeedsUsingGET(values.subscribeUrl);
        setFeedsInfo(res.data);
      } catch (err) {
        console.error('Preview failed:', err);
        enqueueSnackbar('Preview failed. Please check the URL.', {
          variant: 'error',
          anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
        });
      } finally {
        setPreviewing(false);
      }
    },
  });

  const handleFollow = async () => {
    if (!feedsInfo?.feedUrl) return;
    setFollowing(true);
    try {
      await api.followFeedUsingPOST(feedsInfo.feedUrl);
      enqueueSnackbar('Subscribed successfully!', {
        variant: 'success',
        anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
      });
      queryClient.invalidateQueries(['folder-connector-view']);
      handleClose();
    } catch (err) {
      console.error('Follow failed:', err);
      enqueueSnackbar('Failed to subscribe.', {
        variant: 'error',
        anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
      });
    } finally {
      setFollowing(false);
    }
  };

  const handleClose = () => {
    formik.resetForm();
    setFeedsInfo(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <RssFeedIcon sx={{ color: '#f97316' }} />
        Subscribe to RSS
      </DialogTitle>
      <DialogContent>
        <form onSubmit={formik.handleSubmit}>
          <TextField
            fullWidth
            size="small"
            margin="normal"
            label="RSS link"
            id="subscribeUrl"
            name="subscribeUrl"
            placeholder="https://example.com/feed.xml"
            value={formik.values.subscribeUrl}
            onChange={formik.handleChange}
            error={formik.touched.subscribeUrl && Boolean(formik.errors.subscribeUrl)}
            helperText={formik.touched.subscribeUrl && formik.errors.subscribeUrl}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            color="primary"
            variant="contained"
            size="small"
            type="submit"
            disabled={previewing}
            startIcon={previewing ? <CircularProgress size={16} /> : null}
            sx={{ mt: 1 }}
          >
            {previewing ? 'Previewing...' : 'Preview'}
          </Button>
        </form>

        {feedsInfo && (
          <Card sx={{ mt: 2, display: 'flex' }}>
            <div
              style={{
                width: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgb(247,249,249)',
                flexShrink: 0,
              }}
            >
              {feedsInfo.siteFaviconUrl ? (
                <CardMedia
                  component="img"
                  sx={{ width: 48, height: 48 }}
                  image={feedsInfo.siteFaviconUrl}
                  alt={feedsInfo.title}
                />
              ) : (
                <RssFeedIcon sx={{ fontSize: 48, color: '#f97316' }} />
              )}
            </div>
            <CardContent sx={{ flex: 1, borderLeft: '1px solid #e5e7eb' }}>
              <Typography variant="body2" color="text.secondary" noWrap>
                {feedsInfo.siteLink}
              </Typography>
              <Typography variant="subtitle1" fontWeight={600}>
                {feedsInfo.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {feedsInfo.description}
              </Typography>
            </CardContent>
          </Card>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {feedsInfo && !feedsInfo.subscribed && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleFollow}
            disabled={following}
            startIcon={following ? <CircularProgress size={16} /> : <RssFeedIcon />}
          >
            {following ? 'Subscribing...' : 'Subscribe'}
          </Button>
        )}
        {feedsInfo?.subscribed && (
          <Button variant="contained" disabled>
            Already Subscribed
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default SubscribeFeedDialog;

