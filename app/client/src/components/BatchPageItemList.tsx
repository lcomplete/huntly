import { Box, Checkbox, IconButton, Tooltip } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { BatchPageItem } from "../api/batchOrganize";
import SmartMoment from "./SmartMoment";
import { TweetProperties } from "../interfaces/tweetProperties";

const TWEET_CONTENT_MAX_LENGTH = 100;

// Helper to parse tweet properties
function parseTweetProps(item: BatchPageItem): TweetProperties | null {
  const isTweet = item.contentType === 1 || item.contentType === 3;
  if (!isTweet || !item.pageJsonProperties) return null;
  try {
    return JSON.parse(item.pageJsonProperties) as TweetProperties;
  } catch {
    return null;
  }
}

// Helper to get display content for an item
function getItemDisplayContent(item: BatchPageItem): { title: string; subtitle: string | null } {
  const tweetProps = parseTweetProps(item);
  if (tweetProps) {
    const tweetStatus = tweetProps.retweetedTweet || tweetProps;
    const fullText = tweetStatus.fullText || "";
    const truncated = fullText.length > TWEET_CONTENT_MAX_LENGTH
      ? fullText.substring(0, TWEET_CONTENT_MAX_LENGTH) + "..."
      : fullText;
    return { title: truncated, subtitle: null };
  }

  return {
    title: item.title || item.url,
    subtitle: item.description
  };
}

// Helper to get publish time - for tweets, fallback to createdAt in JSON if publishTime is null
function getPublishTime(item: BatchPageItem): string | null {
  if (item.publishTime) return item.publishTime;
  const tweetProps = parseTweetProps(item);
  if (tweetProps) {
    const tweetStatus = tweetProps.retweetedTweet || tweetProps;
    return tweetStatus.createdAt || null;
  }
  return null;
}

interface BatchPageItemListProps {
  readonly items: readonly BatchPageItem[];
  /** Whether to show checkboxes for selection */
  readonly selectable?: boolean;
  /** Set of selected item IDs */
  readonly selectedIds?: ReadonlySet<number>;
  /** Whether all items are globally selected (disables individual checkboxes) */
  readonly selectAll?: boolean;
  /** Callback when an item's selection changes */
  readonly onSelectItem?: (id: number, selected: boolean) => void;
}

export default function BatchPageItemList({
  items,
  selectable = false,
  selectedIds = new Set(),
  selectAll = false,
  onSelectItem,
}: BatchPageItemListProps) {
  return (
    <Box className="space-y-2">
      {items.map((item) => {
        const { title, subtitle } = getItemDisplayContent(item);
        const pubTime = getPublishTime(item);
        const isSelected = selectAll || selectedIds.has(item.id);

        return (
          <Box
            key={item.id}
            className="p-2 border rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}
          >
            {/* Checkbox */}
            {selectable && (
              <Checkbox
                size="small"
                checked={isSelected}
                disabled={selectAll}
                onChange={(e) => onSelectItem?.(item.id, e.target.checked)}
                sx={{ mt: -0.5, ml: -0.5 }}
              />
            )}

            {/* Content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Title with links */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <a
                  href={`/page/${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium truncate hover:underline flex-1"
                  style={{ display: "block", color: "inherit" }}
                >
                  {title}
                </a>
                <Tooltip title="Open original URL">
                  <IconButton
                    size="small"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ flexShrink: 0, p: 0.5 }}
                  >
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Subtitle/Description */}
              {subtitle && (
                <Box className="text-xs text-gray-500 truncate mt-1">{subtitle}</Box>
              )}

              {/* Metadata */}
              <Box className="text-xs text-gray-400 mt-1 flex gap-4 flex-wrap">
                {item.author && <span>Author: {item.author}</span>}
                {item.collectedAt && <span>Collected: <SmartMoment dt={item.collectedAt} /></span>}
                {pubTime && <span>Published: <SmartMoment dt={pubTime} /></span>}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

