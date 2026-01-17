import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Box, Typography, IconButton, Collapse } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { Icon } from '@iconify/react';
import { CollectionTreeVO, CollectionVO, CollectionGroupVO } from '../../../api/collectionApi';

// Helper to render collection icon (emoji or iconify)
const CollectionIcon: React.FC<{ icon?: string | null }> = ({ icon }) => {
  if (!icon) {
    // Default: MUI solid folder icon without color (inherits theme)
    return <FolderIcon sx={{ fontSize: 20 }} />;
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

// Simplified expand/collapse arrow
const ExpandArrow: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 16,
      height: 16,
      transition: 'transform 0.15s ease',
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      color: colors.text.muted,
      fontSize: '12px',
    }}
  >
    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
      <path d="M1.5 1L6 4L1.5 7V1Z" />
    </svg>
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
}> = ({ collection, selectedNodeId, level, onContextMenu }) => {
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);
  const hasChildren = collection.children && collection.children.length > 0;
  const linkTo = `/collection/${collection.id}`;
  const isSelected = selectedNodeId === linkTo;

  const handleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(!expanded);
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
          {/* Expand/Collapse arrow */}
          <Box
            sx={{
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 0.5,
              flexShrink: 0,
              visibility: hasChildren ? 'visible' : 'hidden',
              cursor: hasChildren ? 'pointer' : 'default',
            }}
            onClick={handleExpand}
          >
            {hasChildren && <ExpandArrow expanded={expanded} />}
          </Box>

          {/* Icon - emoji, iconify icon, or default folder */}
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
            }}
          >
            <CollectionIcon icon={collection.icon} />
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
            />
          ))}
        </Collapse>
      )}
    </>
  );
};

// Enhanced Group header - more visible
const GroupHeader: React.FC<{
  group: CollectionGroupVO;
  onContextMenu?: (event: React.MouseEvent, group: CollectionGroupVO) => void;
  isFirst?: boolean;
}> = ({ group, onContextMenu, isFirst = false }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 1.25,
        pt: isFirst ? 0.75 : 2,
        pb: 0.75,
        cursor: onContextMenu ? 'pointer' : 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, group);
      }}
    >
      {/* Group name - more visible with darker color and medium weight */}
      <Typography
        sx={{
          fontSize: '14px',
          fontWeight: 600,
          color: colors.text.groupTitle,
          flexGrow: 1,
          userSelect: 'none',
        }}
      >
        {group.name}
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
      {/* Unsorted item */}
      <UnsortedItem selectedNodeId={selectedNodeId} count={treeData.unsortedCount} />

      {/* Groups and Collections */}
      {treeData.groups.map((group, index) => (
        <Box key={group.id}>
          <GroupHeader
            group={group}
            onContextMenu={onGroupContextMenu}
            isFirst={index === 0}
          />
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
              />
            ))
          )}
        </Box>
      ))}
    </Box>
  );
}
