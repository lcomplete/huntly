/**
 * RSS Subscription Component
 * Displays a subscription interface when the current tab is an RSS feed
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Typography,
} from '@mui/material';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { PreviewFeedsInfo, previewFeed, subscribeFeed } from './rssService';

export interface RssSubscriptionProps {
  feedUrl: string;
}

type SubscriptionState = 'loading' | 'idle' | 'subscribing' | 'success' | 'error';

function handleClose() {
  window.close();
}

export const RssSubscription: React.FC<RssSubscriptionProps> = ({ feedUrl }) => {
  const [state, setState] = useState<SubscriptionState>('loading');
  const [feedInfo, setFeedInfo] = useState<PreviewFeedsInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAlreadySubscribed, setIsAlreadySubscribed] = useState(false);

  useEffect(() => {
    loadFeedInfo();
  }, [feedUrl]);

  async function loadFeedInfo() {
    setState('loading');
    setError(null);
    try {
      const info = await previewFeed(feedUrl);
      if (info) {
        setFeedInfo(info);
        setIsAlreadySubscribed(info.subscribed === true);
        setState('idle');
      } else {
        setError('Could not parse the feed. Please check if the URL is valid.');
        setState('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed information');
      setState('error');
    }
  }

  async function handleSubscribe() {
    setState('subscribing');
    setError(null);
    try {
      const result = await subscribeFeed(feedUrl);
      if (result.success) {
        setState('success');
        setIsAlreadySubscribed(true);
      } else {
        setError(result.error || 'Failed to subscribe to feed');
        setState('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe to feed');
      setState('error');
    }
  }

  return (
    <Box sx={{ p: 2, minWidth: 400 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <RssFeedIcon sx={{ color: 'orange', mr: 1 }} />
        <Typography variant="h6" component="h2">
          RSS Feed Detected
        </Typography>
      </Box>

      {state === 'loading' && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {state === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {(state === 'idle' || state === 'subscribing' || state === 'success') && feedInfo && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
              {feedInfo.title || 'Untitled Feed'}
            </Typography>
            {feedInfo.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {feedInfo.description}
              </Typography>
            )}
            <Typography variant="caption" color="text.disabled" sx={{ wordBreak: 'break-all' }}>
              {feedUrl}
            </Typography>
          </CardContent>
        </Card>
      )}

      {state === 'success' && (
        <Alert icon={<CheckCircleIcon />} severity="success" sx={{ mb: 2 }}>
          Successfully subscribed to this feed!
        </Alert>
      )}

      {isAlreadySubscribed && state !== 'success' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You are already subscribed to this feed.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={handleClose}>
          Close
        </Button>
        {!isAlreadySubscribed && state !== 'success' && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubscribe}
            disabled={state === 'loading' || state === 'subscribing'}
            startIcon={state === 'subscribing' ? <CircularProgress size={16} /> : <RssFeedIcon />}
          >
            {state === 'subscribing' ? 'Subscribing...' : 'Subscribe'}
          </Button>
        )}
      </Box>
    </Box>
  );
};

