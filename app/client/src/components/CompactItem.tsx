import * as React from 'react';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import {Box} from '@mui/material';
import {Link} from "react-router-dom";
import {PageItem} from "../api";
import SmartMoment from "./SmartMoment";
import {useState, useEffect} from "react";
import GitHubIcon from "@mui/icons-material/GitHub";
import {ConnectorType} from "../interfaces/connectorType";
import TextSnippetOutlinedIcon from '@mui/icons-material/TextSnippetOutlined';

type CompactItemProps = {
  page: PageItem,
  onPageSelect?: (event: any, id: number) => void,
  showMarkReadOption?: boolean,
  currentVisit?: boolean
}

export default function CompactItem({
  page,
  onPageSelect,
  showMarkReadOption,
  currentVisit,
}: CompactItemProps) {

  const [readed, setReaded] = useState(page.markRead);
  const isSnippet = page.contentType === 4;
  const isGithub = page.connectorType === ConnectorType.GITHUB;

  const handleFaviconError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = '/fallback-icon.svg';
  };

  const handleThumbError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = '/fallback-thumb.svg';
  };

  useEffect(() => {
    setReaded(page.markRead);
  }, [page.markRead]);

  function pageSelect(e: React.MouseEvent<HTMLAnchorElement>, id: number) {
    setReaded(true);
    if (onPageSelect) {
      onPageSelect(e, id);
    }
  }

  return (
    <Box
      className={`w-full py-1.5 hover:bg-gray-50 transition-colors ${currentVisit ? "bg-blue-50" : ""}`}
      key={page.id}
    >
      <Link to={`/page/${page.id}`} onClick={(e) => pageSelect(e, page.id)} className="block">
        <Box sx={{display: 'flex', gap: 1.5, alignItems: 'flex-start'}}>
          <Box className="grow min-w-0">
            <Typography
              variant="body1"
              className={`line-clamp-2 font-medium mb-0.5 ${readed && showMarkReadOption ? "text-neutral-500" : "text-gray-900"}`}
              sx={{
                fontSize: '0.875rem',
                lineHeight: 1.4,
                wordBreak: 'break-word'
              }}
            >
              {page.title}
            </Typography>

            <Box className="flex items-center text-xs text-gray-500 gap-1.5">
              {page.faviconUrl ? (
                <CardMedia
                  component="img"
                  image={page.faviconUrl}
                  onError={handleFaviconError}
                  sx={{ width: 12, height: 12, flexShrink: 0 }}
                />
              ) : isGithub ? (
                <GitHubIcon sx={{ width: 12, height: 12, color: 'rgb(24, 23, 23)' }} />
              ) : null}

              <span className="truncate max-w-[180px]">
                {page.siteName || page.domain}
              </span>

              <span>·</span>

              <SmartMoment dt={page.recordAt} />
            </Box>
          </Box>

          {isSnippet && (
            <Box
              className="flex items-center justify-center bg-gray-100 rounded"
              sx={{width: 48, height: 48, flexShrink: 0}}
            >
              <TextSnippetOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            </Box>
          )}

          {page.thumbUrl && !isSnippet && (
            <Box className="rounded overflow-hidden" sx={{width: 72, height: 48, flexShrink: 0}}>
              <CardMedia
                component="img"
                sx={{width: '100%', height: '100%', objectFit: 'cover'}}
                image={page.thumbUrl}
                alt={page.title}
                onError={handleThumbError}
              />
            </Box>
          )}
        </Box>
      </Link>
    </Box>
  );
}
