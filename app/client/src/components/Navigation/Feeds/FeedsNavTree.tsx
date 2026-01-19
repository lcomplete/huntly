import React, { useState, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { Box, Typography, IconButton, Collapse } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { ConnectorItem, Folder, FolderConnectors, SettingControllerApiFactory } from '../../../api';
import { reorder } from '../../../common/arrayUtils';
import { ConnectorType } from '../../../interfaces/connectorType';
import navLabels from '../shared/NavLabels';

// Storage key for expanded folders state
const STORAGE_KEY_FOLDERS = 'huntly-feeds-folders-expanded';

// Helper to load expanded state from localStorage
function loadExpandedState(key: string): Record<string, boolean> {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// Helper to save expanded state to localStorage
function saveExpandedState(key: string, state: Record<string, boolean>) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

// Color system matching NavListItem/CollectionTree style
const colors = {
  primary: '#3b82f6',
  text: {
    primary: '#475569',
    selected: '#2563eb',
    muted: '#64748b',
  },
  hover: {
    light: 'rgba(59, 130, 246, 0.05)',
    selected: 'rgba(59, 130, 246, 0.10)',
  },
  selected: {
    bg: 'rgba(59, 130, 246, 0.10)',
  },
};

// Spacing constants matching CollectionTree/NavListItem
const arrowPlaceholderWidth = 1; // ~8px for arrow space
const basePadding = 1.25;
const totalLeftPadding = basePadding + arrowPlaceholderWidth; // 2.25
const levelIndent = 2.5; // Indent for nested items

// Expand/collapse arrow
const ExpandArrow: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 16,
      height: 16,
      transition: 'transform 0.2s ease',
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      color: colors.text.muted,
    }}
  >
    <ChevronRightIcon sx={{ fontSize: 16 }} />
  </Box>
);

export type FeedsNavTreeProps = {
  folderConnectors: FolderConnectors[];
  selectedNodeId: string;
  allInboxCount: number;
  showUnreadOnly?: boolean;
  onFolderContextMenu?: (event: React.MouseEvent, folder: Folder) => void;
  onFeedContextMenu?: (event: React.MouseEvent, feed: ConnectorItem) => void;
};

// All Feeds item - matching NavListItem/CollectionTree style
const AllFeedsItem: React.FC<{
  selectedNodeId: string;
  count: number;
}> = ({ selectedNodeId, count }) => {
  const linkTo = navLabels.allFeeds.linkTo;
  const isSelected = selectedNodeId === linkTo;
  const LabelIcon = navLabels.allFeeds.labelIcon;

  return (
    <NavLink to={linkTo} style={{ textDecoration: 'none' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          pl: totalLeftPadding,
          pr: totalLeftPadding,
          py: 0.875,
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          bgcolor: isSelected ? colors.selected.bg : 'transparent',
          '&:hover': {
            bgcolor: isSelected ? colors.selected.bg : colors.hover.light,
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 1,
            color: isSelected ? colors.primary : colors.text.muted,
            transition: 'color 0.15s ease',
          }}
        >
          <LabelIcon sx={{ fontSize: 20 }} />
        </Box>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: isSelected ? 600 : 500,
            color: isSelected ? colors.text.selected : colors.text.primary,
            lineHeight: 1.4,
            transition: 'color 0.15s ease',
            flexGrow: 1,
          }}
        >
          {navLabels.allFeeds.labelText}
        </Typography>
        {count > 0 && (
          <Box
            sx={{
              ml: 1,
              color: isSelected ? colors.text.primary : colors.text.muted,
              fontSize: '11.5px',
              fontWeight: 600,
              lineHeight: 1.4,
            }}
          >
            {count}
          </Box>
        )}
      </Box>
    </NavLink>
  );
};

// Feed item component - matching CollectionTree style
const FeedItem: React.FC<{
  feed: ConnectorItem;
  selectedNodeId: string;
  level?: number; // For indentation when inside a folder
  onContextMenu?: (event: React.MouseEvent, feed: ConnectorItem) => void;
}> = ({ feed, selectedNodeId, level = 0, onContextMenu }) => {
  const [hovered, setHovered] = useState(false);
  const [hasIconError, setHasIconError] = useState(false);
  const linkTo = '/connector/' + feed.id;
  const isSelected = selectedNodeId === linkTo;
  const FeedIcon = feed.type === ConnectorType.RSS ? RssFeedIcon : navLabels.github.labelIcon;

  return (
    <NavLink
      to={linkTo}
      style={{ textDecoration: 'none' }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, feed);
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          pl: totalLeftPadding + level * levelIndent,
          pr: totalLeftPadding,
          py: 0.875,
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          bgcolor: isSelected ? colors.selected.bg : 'transparent',
          '&:hover': {
            bgcolor: isSelected ? colors.selected.bg : colors.hover.light,
          },
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            mr: 1,
            flexShrink: 0,
          }}
        >
          {feed.iconUrl && !hasIconError ? (
            <Box
              component="img"
              sx={{ width: 20, height: 20, opacity: 0.8 }}
              src={feed.iconUrl}
              onError={() => setHasIconError(true)}
            />
          ) : (
            <FeedIcon sx={{ fontSize: 20, color: isSelected ? colors.primary : colors.text.muted }} />
          )}
        </Box>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: isSelected ? 600 : 500,
            color: isSelected ? colors.text.selected : colors.text.primary,
            lineHeight: 1.4,
            transition: 'color 0.15s ease',
            flexGrow: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {feed.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, justifyContent: 'flex-end' }}>
          {hovered ? (
            <IconButton
              size="small"
              sx={{
                width: 20,
                height: 20,
                color: colors.text.muted,
                '&:hover': { bgcolor: 'rgba(0,0,0,0.08)' },
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onContextMenu?.(e, feed);
              }}
            >
              <MoreHorizIcon sx={{ fontSize: 16 }} />
            </IconButton>
          ) : (
            feed.inboxCount > 0 && (
              <Box
                sx={{
                  color: isSelected ? colors.text.primary : colors.text.muted,
                  fontSize: '11.5px',
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                {feed.inboxCount}
              </Box>
            )
          )}
        </Box>
      </Box>
    </NavLink>
  );
};

// Folder item component - matching CollectionTree style
const FolderItem: React.FC<{
  folder: FolderConnectors;
  selectedNodeId: string;
  expanded: boolean;
  onToggle: () => void;
  onContextMenu?: (event: React.MouseEvent, folder: Folder) => void;
  onFeedContextMenu?: (event: React.MouseEvent, feed: ConnectorItem) => void;
}> = ({ folder, selectedNodeId, expanded, onToggle, onContextMenu, onFeedContextMenu }) => {
  const [hovered, setHovered] = useState(false);
  const linkTo = '/folder/' + folder.id;
  const isSelected = selectedNodeId === linkTo;
  const inboxCount = folder.connectorItems?.reduce((sum, f) => sum + (f.inboxCount || 0), 0) || 0;
  const hasChildren = folder.connectorItems && folder.connectorItems.length > 0;

  const handleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (folder.id) {
      onContextMenu?.(e, { id: folder.id, name: folder.name } as Folder);
    }
  };

  return (
    <>
      <NavLink to={linkTo} style={{ textDecoration: 'none' }} onContextMenu={handleContextMenu}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            pl: totalLeftPadding,
            pr: totalLeftPadding,
            py: 0.875,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            bgcolor: isSelected ? colors.selected.bg : 'transparent',
            '&:hover': {
              bgcolor: isSelected ? colors.selected.bg : colors.hover.light,
            },
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Expand arrow - positioned left of icon */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              mr: 0.25,
              ml: -2.5, // Move arrow into left padding area like CollectionTree
              cursor: hasChildren ? 'pointer' : 'default',
              visibility: hasChildren ? 'visible' : 'hidden',
            }}
            onClick={hasChildren ? handleExpand : undefined}
          >
            <ExpandArrow expanded={expanded} />
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              mr: 1,
              flexShrink: 0,
              color: isSelected ? colors.primary : colors.text.muted,
              transition: 'color 0.15s ease',
            }}
          >
            <FolderOpenIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography
            sx={{
              fontSize: '14px',
              fontWeight: isSelected ? 600 : 500,
              color: isSelected ? colors.text.selected : colors.text.primary,
              lineHeight: 1.4,
              transition: 'color 0.15s ease',
              flexGrow: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {folder.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, justifyContent: 'flex-end' }}>
            {hovered ? (
              <IconButton
                size="small"
                sx={{
                  width: 20,
                  height: 20,
                  color: colors.text.muted,
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.08)' },
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (folder.id) {
                    onContextMenu?.(e, { id: folder.id, name: folder.name } as Folder);
                  }
                }}
              >
                <MoreHorizIcon sx={{ fontSize: 16 }} />
              </IconButton>
            ) : (
              inboxCount > 0 && (
                <Box
                  sx={{
                    color: isSelected ? colors.text.primary : colors.text.muted,
                    fontSize: '11.5px',
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}
                >
                  {inboxCount}
                </Box>
              )
            )}
          </Box>
        </Box>
      </NavLink>
      {/* Children feeds - indented to align with parent icon */}
      {hasChildren && (
        <Collapse in={expanded} timeout={200}>
          <Droppable droppableId={`folder-${folder.id}`} type={`FEEDS-${folder.id}`}>
            {(provided) => (
              <Box ref={provided.innerRef} {...provided.droppableProps} sx={{ minHeight: 4 }}>
                {folder.connectorItems.map((feed, index) => (
                  <Draggable key={feed.id} draggableId={`feed-${feed.id}`} index={index}>
                    {(dragProvided, snapshot) => (
                      <Box
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        sx={{
                          bgcolor: snapshot.isDragging ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                          borderRadius: '8px',
                        }}
                      >
                        <FeedItem
                          feed={feed}
                          selectedNodeId={selectedNodeId}
                          level={1}
                          onContextMenu={onFeedContextMenu}
                        />
                      </Box>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        </Collapse>
      )}
    </>
  );
};

// Main FeedsNavTree component
export default function FeedsNavTree({
  folderConnectors,
  selectedNodeId,
  allInboxCount,
  showUnreadOnly = false,
  onFolderContextMenu,
  onFeedContextMenu,
}: FeedsNavTreeProps) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const api = SettingControllerApiFactory();

  // State for expanded folders - persisted to localStorage
  const [folderExpandedState, setFolderExpandedState] = useState<Record<string, boolean>>(() =>
    loadExpandedState(STORAGE_KEY_FOLDERS)
  );

  // Toggle folder expanded state
  const handleToggleFolder = useCallback((folderId: number) => {
    setFolderExpandedState((prev) => {
      const newState = { ...prev, [folderId]: prev[folderId] === false };
      saveExpandedState(STORAGE_KEY_FOLDERS, newState);
      return newState;
    });
  }, []);

  // Separate folders from root-level feeds
  const allFolders = folderConnectors.filter((fc) => fc.id && fc.name);
  const allRootFeeds = folderConnectors.filter((fc) => !fc.id).flatMap((fc) => fc.connectorItems || []);

  // Filter by unread if needed
  const folders = showUnreadOnly
    ? allFolders.filter((f) => f.connectorItems?.some((feed) => (feed.inboxCount || 0) > 0))
    : allFolders;
  const rootFeeds = showUnreadOnly
    ? allRootFeeds.filter((feed) => (feed.inboxCount || 0) > 0)
    : allRootFeeds;

  // Handle drag end for reordering
  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { source, destination, type } = result;

      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) {
        return;
      }

      if (type === 'FOLDER') {
        // Reordering folders
        const reorderedFolders = reorder(folders, source.index, destination.index);
        const folderIds = reorderedFolders.map((f) => f.id).filter((id): id is number => id !== undefined);

        // Optimistic update
        const currentData = queryClient.getQueryData<{ folderFeedConnectors: FolderConnectors[] }>(['folder-connector-view']);
        if (currentData) {
          const newFolderConnectors = [
            ...rootFeeds.length > 0 ? [{ connectorItems: rootFeeds }] : [],
            ...reorderedFolders,
          ];
          queryClient.setQueryData(['folder-connector-view'], {
            ...currentData,
            folderFeedConnectors: newFolderConnectors,
          });
        }

        try {
          await api.resortFoldersUsingPOST(folderIds);
          enqueueSnackbar('Folders order updated.', {
            variant: 'success',
            anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
          });
        } catch (err) {
          // Revert on error
          queryClient.invalidateQueries(['folder-connector-view']);
          enqueueSnackbar('Failed to update folders order.', {
            variant: 'error',
            anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
          });
        }
      } else if (type === 'ROOT-FEEDS') {
        // Reordering root-level feeds
        const reorderedFeeds = reorder(rootFeeds, source.index, destination.index);
        const feedIds = reorderedFeeds.map((f) => f.id).filter((id): id is number => id !== undefined);

        // Optimistic update
        const currentData = queryClient.getQueryData<{ folderFeedConnectors: FolderConnectors[] }>(['folder-connector-view']);
        if (currentData) {
          const newFolderConnectors = currentData.folderFeedConnectors.map((fc) => {
            if (!fc.id) {
              return { ...fc, connectorItems: reorderedFeeds };
            }
            return fc;
          });
          queryClient.setQueryData(['folder-connector-view'], {
            ...currentData,
            folderFeedConnectors: newFolderConnectors,
          });
        }

        try {
          await api.resortConnectorsUsingPOST(feedIds);
          enqueueSnackbar('Feeds order updated.', {
            variant: 'success',
            anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
          });
        } catch (err) {
          queryClient.invalidateQueries(['folder-connector-view']);
          enqueueSnackbar('Failed to update feeds order.', {
            variant: 'error',
            anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
          });
        }
      } else if (type.startsWith('FEEDS-')) {
        // Reordering feeds within a folder
        const folderId = Number.parseInt(type.replace('FEEDS-', ''), 10);
        const folder = folders.find((f) => f.id === folderId);
        if (!folder || !folder.connectorItems) return;

        const reorderedFeeds = reorder(folder.connectorItems, source.index, destination.index);
        const feedIds = reorderedFeeds.map((f) => f.id).filter((id): id is number => id !== undefined);

        // Optimistic update
        const currentData = queryClient.getQueryData<{ folderFeedConnectors: FolderConnectors[] }>(['folder-connector-view']);
        if (currentData) {
          const newFolderConnectors = currentData.folderFeedConnectors.map((fc) => {
            if (fc.id === folderId) {
              return { ...fc, connectorItems: reorderedFeeds };
            }
            return fc;
          });
          queryClient.setQueryData(['folder-connector-view'], {
            ...currentData,
            folderFeedConnectors: newFolderConnectors,
          });
        }

        try {
          await api.resortConnectorsUsingPOST(feedIds);
          enqueueSnackbar('Feeds order updated.', {
            variant: 'success',
            anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
          });
        } catch (err) {
          queryClient.invalidateQueries(['folder-connector-view']);
          enqueueSnackbar('Failed to update feeds order.', {
            variant: 'error',
            anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
          });
        }
      }
    },
    [folders, rootFeeds, queryClient, api, enqueueSnackbar]
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Box sx={{ pt: 0.25, pb: 0.25 }}>
        {/* All Feeds item */}
        <AllFeedsItem selectedNodeId={selectedNodeId} count={allInboxCount} />

        {/* Divider between All Feeds and feed list */}
        <Box
          sx={{
            height: '1px',
            bgcolor: 'rgba(0, 0, 0, 0.08)',
            mx: 1.25,
            my: 0.75,
          }}
        />

        {/* Root level feeds (without folder) */}
        {rootFeeds.length > 0 && (
          <Droppable droppableId="root-feeds" type="ROOT-FEEDS">
            {(provided) => (
              <Box ref={provided.innerRef} {...provided.droppableProps}>
                {rootFeeds.map((feed, index) => (
                  <Draggable key={feed.id} draggableId={`root-feed-${feed.id}`} index={index}>
                    {(dragProvided, snapshot) => (
                      <Box
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        sx={{
                          bgcolor: snapshot.isDragging ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                          borderRadius: '8px',
                        }}
                      >
                        <FeedItem
                          feed={feed}
                          selectedNodeId={selectedNodeId}
                          level={0}
                          onContextMenu={onFeedContextMenu}
                        />
                      </Box>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        )}

        {/* Folders with feeds */}
        {folders.length > 0 && (
          <Droppable droppableId="folders" type="FOLDER">
            {(provided) => (
              <Box ref={provided.innerRef} {...provided.droppableProps}>
                {folders.map((folder, index) => {
                  const isExpanded = folderExpandedState[folder.id!] !== false;
                  return (
                    <Draggable key={folder.id} draggableId={`folder-${folder.id}`} index={index}>
                      {(dragProvided, snapshot) => (
                        <Box
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          sx={{
                            bgcolor: snapshot.isDragging ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                            borderRadius: '8px',
                          }}
                        >
                          <FolderItem
                            folder={folder}
                            selectedNodeId={selectedNodeId}
                            expanded={isExpanded}
                            onToggle={() => handleToggleFolder(folder.id!)}
                            onContextMenu={onFolderContextMenu}
                            onFeedContextMenu={onFeedContextMenu}
                          />
                        </Box>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        )}
      </Box>
    </DragDropContext>
  );
}

