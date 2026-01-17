import React, { useState, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { Box, Typography, IconButton, Collapse } from '@mui/material';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Icon } from '@iconify/react';
import { CollectionTreeVO, CollectionVO, CollectionGroupVO } from '../../../api/collectionApi';

// Storage keys for persisting expanded state
const STORAGE_KEY_GROUPS = 'huntly-collection-groups-expanded';
const STORAGE_KEY_COLLECTIONS = 'huntly-collections-expanded';

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

// Helper to render collection icon (emoji or iconify)
const CollectionIcon: React.FC<{ icon?: string | null }> = ({ icon }) => {
  if (!icon) {
    // Default: MUI outlined folder icon without color (inherits theme)
    return <FolderOutlinedIcon sx={{ fontSize: 20 }} />;
  }

  // Check if it's an iconify icon (contains colon like 'flat-color-icons:folder')
  if (icon.includes(':')) {
    return <Icon icon={icon} width={20} height={20} />;
  }

  // It's an emoji
  return <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>;
};

// Color system matching NavListItem style
const colors = {
  primary: '#3b82f6',      // Blue for selected items (matching NavListItem)
  text: {
    primary: '#475569',    // Slate 600 (matching NavListItem normal text)
    selected: '#2563eb',   // Blue 600 (matching NavListItem selected text)
    muted: '#64748b',      // Slate 500 for counts
    groupTitle: '#334155', // Slate 700 for group headers (more visible)
  },
  hover: {
    light: 'rgba(59, 130, 246, 0.05)',    // Matching NavListItem
    selected: 'rgba(59, 130, 246, 0.10)', // Matching NavListItem
  },
  selected: {
    bg: 'rgba(59, 130, 246, 0.10)',      // Matching NavListItem (light blue)
  },
};

// Expand/collapse arrow using MUI ChevronRightIcon
const ExpandArrow: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 18,
      height: 18,
      transition: 'transform 0.2s ease',
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      color: colors.text.muted,
    }}
  >
    <ChevronRightIcon sx={{ fontSize: 18 }} />
  </Box>
);

type CollectionTreeProps = Readonly<{
  selectedNodeId: string;
  treeData: CollectionTreeVO | null;
  onCollectionContextMenu?: (event: React.MouseEvent, collection: CollectionVO) => void;
  onGroupContextMenu?: (event: React.MouseEvent, group: CollectionGroupVO) => void;
}>;

// Unsorted navigation item - matching NavListItem style
const UnsortedItem: React.FC<{
  selectedNodeId: string;
  count: number;
}> = ({ selectedNodeId, count }) => {
  const linkTo = '/collection/unsorted';
  const isSelected = selectedNodeId === linkTo;

  return (
    <NavLink to={linkTo} style={{ textDecoration: 'none' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.25,
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
          <InboxOutlinedIcon sx={{ fontSize: 20 }} />
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
          Unsorted
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

// Collection item - matching NavListItem style
const CollectionItem: React.FC<{
  collection: CollectionVO;
  selectedNodeId: string;
  level: number;
  onContextMenu?: (event: React.MouseEvent, collection: CollectionVO) => void;
  collectionExpandedState: Record<string, boolean>;
  onToggleCollection: (id: number) => void;
}> = ({ collection, selectedNodeId, level, onContextMenu, collectionExpandedState, onToggleCollection }) => {
  const [hovered, setHovered] = useState(false);
  const hasChildren = collection.children && collection.children.length > 0;
  const linkTo = `/collection/${collection.id}`;
  const isSelected = selectedNodeId === linkTo;
  // Default to expanded if not in state
  const expanded = collectionExpandedState[collection.id] !== false;

  const handleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleCollection(collection.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(e, collection);
  };

  // Indentation matching NavListItem base padding
  const basePadding = 1.25;
  const levelIndent = 1.5;

  return (
    <>
      <NavLink
        to={linkTo}
        style={{ textDecoration: 'none' }}
        onContextMenu={handleContextMenu}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            pl: basePadding + level * levelIndent,
            pr: 1.25,
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
          {/* Icon - shows arrow when hovered and has children, otherwise shows collection icon */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 1,
              flexShrink: 0,
              fontSize: '16px',
              color: isSelected ? colors.primary : colors.text.muted,
              transition: 'color 0.15s ease',
              cursor: hasChildren && hovered ? 'pointer' : 'default',
            }}
            onClick={hasChildren ? handleExpand : undefined}
          >
            {hovered && hasChildren ? (
              <ExpandArrow expanded={expanded} />
            ) : (
              <CollectionIcon icon={collection.icon} />
            )}
          </Box>

          {/* Collection Name */}
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
            {collection.name}
          </Typography>

          {/* Right side: count or menu button */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              ml: 1,
              minWidth: 24,
              justifyContent: 'flex-end',
            }}
          >
            {hovered ? (
              <IconButton
                size="small"
                sx={{
                  width: 20,
                  height: 20,
                  color: colors.text.muted,
                  '&:hover': {
                    bgcolor: 'rgba(0,0,0,0.08)',
                  },
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onContextMenu?.(e, collection);
                }}
              >
                <MoreHorizIcon sx={{ fontSize: 16 }} />
              </IconButton>
            ) : (
              collection.pageCount > 0 && (
                <Box
                  sx={{
                    color: isSelected ? colors.text.primary : colors.text.muted,
                    fontSize: '11.5px',
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}
                >
                  {collection.pageCount}
                </Box>
              )
            )}
          </Box>
        </Box>
      </NavLink>

      {/* Children */}
      {hasChildren && (
        <Collapse in={expanded} timeout={200}>
          {collection.children.map((child) => (
            <CollectionItem
              key={child.id}
              collection={child}
              selectedNodeId={selectedNodeId}
              level={level + 1}
              onContextMenu={onContextMenu}
              collectionExpandedState={collectionExpandedState}
              onToggleCollection={onToggleCollection}
            />
          ))}
        </Collapse>
      )}
    </>
  );
};

// Group header - clickable to expand/collapse with hover effects
const GroupHeader: React.FC<{
  group: CollectionGroupVO;
  expanded: boolean;
  onToggle: () => void;
  onContextMenu?: (event: React.MouseEvent, group: CollectionGroupVO) => void;
}> = ({ group, expanded, onToggle, onContextMenu }) => {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    // Only toggle if not clicking on the menu button
    if (!(e.target as HTMLElement).closest('button')) {
      onToggle();
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 1.25,
        py: 0.875,
        mb: 0.5, // Small spacing below group header
        borderRadius: '8px',
        cursor: 'pointer',
        userSelect: 'none',
        minHeight: 36,
        transition: 'all 0.15s ease',
        '&:hover': {
          bgcolor: colors.hover.light,
        },
      }}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, group);
      }}
    >
      {/* Group name with arrow on hover - secondary color, bold */}
      <Typography
        component="div"
        sx={{
          fontSize: '14px',
          fontWeight: 600, // Bold
          color: colors.text.muted, // Secondary color (slate 500)
          lineHeight: 1.4,
          flexGrow: 1,
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {group.name}
        {/* Arrow right next to text */}
        {hovered && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              ml: 0.5,
            }}
          >
            <ExpandArrow expanded={expanded} />
          </Box>
        )}
      </Typography>

      {/* Menu button on hover */}
      {hovered && onContextMenu && (
        <IconButton
          size="small"
          sx={{
            width: 20,
            height: 20,
            color: colors.text.muted,
            '&:hover': {
              bgcolor: 'rgba(0,0,0,0.08)',
            },
          }}
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, group);
          }}
        >
          <MoreHorizIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Box>
  );
};

// Main CollectionTree component
export default function CollectionTree({
  selectedNodeId,
  treeData,
  onCollectionContextMenu,
  onGroupContextMenu,
}: CollectionTreeProps) {
  // State for expanded groups - persisted to localStorage
  const [groupExpandedState, setGroupExpandedState] = useState<Record<string, boolean>>(() =>
    loadExpandedState(STORAGE_KEY_GROUPS)
  );

  // State for expanded collections - persisted to localStorage
  const [collectionExpandedState, setCollectionExpandedState] = useState<Record<string, boolean>>(() =>
    loadExpandedState(STORAGE_KEY_COLLECTIONS)
  );

  // Toggle group expanded state
  const handleToggleGroup = useCallback((groupId: number) => {
    setGroupExpandedState((prev) => {
      const newState = { ...prev, [groupId]: prev[groupId] === false };
      saveExpandedState(STORAGE_KEY_GROUPS, newState);
      return newState;
    });
  }, []);

  // Toggle collection expanded state
  const handleToggleCollection = useCallback((collectionId: number) => {
    setCollectionExpandedState((prev) => {
      const newState = { ...prev, [collectionId]: prev[collectionId] === false };
      saveExpandedState(STORAGE_KEY_COLLECTIONS, newState);
      return newState;
    });
  }, []);

  if (!treeData) {
    return null;
  }

  return (
    <Box
      sx={{
        mt: 1.5,
        pt: 1.5,
        borderTop: `1px solid rgba(0, 0, 0, 0.08)`,
      }}
    >
      {/* Collections section title */}
      <Typography
        sx={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#334155', // Same as SidebarHeader
          letterSpacing: '0.01em',
          px: 1.25,
          pb: 1, // Increased spacing below title
        }}
      >
        Collections
      </Typography>

      {/* Unsorted item with spacing below */}
      <Box sx={{ mb: 0.5 }}>
        <UnsortedItem selectedNodeId={selectedNodeId} count={treeData.unsortedCount} />
      </Box>

      {/* Groups and Collections */}
      {treeData.groups.map((group) => {
        // Default to expanded if not in state
        const isGroupExpanded = groupExpandedState[group.id] !== false;

        return (
          <Box key={group.id}>
            <GroupHeader
              group={group}
              expanded={isGroupExpanded}
              onToggle={() => handleToggleGroup(group.id)}
              onContextMenu={onGroupContextMenu}
            />
            <Collapse in={isGroupExpanded} timeout={200}>
              {group.collections.length === 0 ? (
                <Typography
                  sx={{
                    fontSize: '13px',
                    color: colors.text.muted,
                    fontStyle: 'italic',
                    px: 1.25,
                    py: 0.5,
                  }}
                >
                  No collections yet
                </Typography>
              ) : (
                group.collections.map((collection) => (
                  <CollectionItem
                    key={collection.id}
                    collection={collection}
                    selectedNodeId={selectedNodeId}
                    level={0}
                    onContextMenu={onCollectionContextMenu}
                    collectionExpandedState={collectionExpandedState}
                    onToggleCollection={handleToggleCollection}
                  />
                ))
              )}
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );
}
