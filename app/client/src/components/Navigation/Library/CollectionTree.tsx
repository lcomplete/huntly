import React, { useState, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { Box, Typography, IconButton, Collapse } from '@mui/material';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Icon } from '@iconify/react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useQueryClient } from '@tanstack/react-query';
import { CollectionTreeVO, CollectionVO, CollectionGroupVO, CollectionApi } from '../../../api/collectionApi';

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

  // It's an emoji - fixed size container to prevent layout shift
  return (
    <span style={{
      fontSize: 16,
      lineHeight: 1,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 20,
    }}>
      {icon}
    </span>
  );
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

type CollectionTreeProps = Readonly<{
  selectedNodeId: string;
  treeData: CollectionTreeVO | null;
  onCollectionContextMenu?: (event: React.MouseEvent, collection: CollectionVO) => void;
  onGroupContextMenu?: (event: React.MouseEvent, group: CollectionGroupVO) => void;
}>;

// Arrow placeholder width to align icons across all items
const arrowPlaceholderWidth = 1; // ~8px for arrow space
// Base padding for symmetry
const basePaddingNav = 1.25;
const totalLeftPadding = basePaddingNav + arrowPlaceholderWidth; // 2.25

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
          pl: totalLeftPadding,
          pr: totalLeftPadding, // Symmetric padding
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

// Collection item content - the visual part without drag wrapper
const CollectionItemContent: React.FC<{
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

  // Indentation: align child arrow with parent icon center
  // Arrow: ml -2.5 (20px left) + width 16px + mr 0.25 (2px) = icon starts at -2px
  // Icon width 20px, center at 8px from content start
  // Arrow center at -12px from content start
  // To align child arrow center with parent icon center: 8 - (-12) = 20px = 2.5 units
  const levelIndent = 2.5;

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
            // All levels: use totalLeftPadding so icon aligns with group/unsorted
            // Level > 0: add level indentation
            pl: totalLeftPadding + level * levelIndent,
            pr: totalLeftPadding, // Symmetric padding
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
          {/* Arrow - positioned left of icon with small gap */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              mr: 0.25, // Small gap between arrow and icon
              ml: -2.5, // Move arrow into the left padding area
              cursor: hasChildren ? 'pointer' : 'default',
              visibility: hasChildren ? 'visible' : 'hidden',
            }}
            onClick={hasChildren ? handleExpand : undefined}
          >
            <ExpandArrow expanded={expanded} />
          </Box>

          {/* Icon - always shows collection icon with fixed width */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
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

      {/* Children - with their own Droppable for nested drag and drop */}
      {hasChildren && (
        <Collapse in={expanded} timeout={200}>
          <Droppable droppableId={`parent-${collection.id}`} type={`CHILDREN-${collection.id}`}>
            {(childProvided) => (
              <Box
                ref={childProvided.innerRef}
                {...childProvided.droppableProps}
                sx={{ minHeight: 4 }}
              >
                {collection.children.map((child, childIndex) => (
                  <Draggable
                    key={child.id}
                    draggableId={`collection-${child.id}`}
                    index={childIndex}
                  >
                    {(childDragProvided, childSnapshot) => (
                      <Box
                        ref={childDragProvided.innerRef}
                        {...childDragProvided.draggableProps}
                        {...childDragProvided.dragHandleProps}
                        sx={{
                          bgcolor: childSnapshot.isDragging
                            ? 'rgba(59, 130, 246, 0.08)'
                            : 'transparent',
                          borderRadius: '8px',
                          transition: childSnapshot.isDragging
                            ? 'none'
                            : 'background-color 0.15s ease',
                        }}
                      >
                        <CollectionItemContent
                          collection={child}
                          selectedNodeId={selectedNodeId}
                          level={level + 1}
                          onContextMenu={onContextMenu}
                          collectionExpandedState={collectionExpandedState}
                          onToggleCollection={onToggleCollection}
                        />
                      </Box>
                    )}
                  </Draggable>
                ))}
                {childProvided.placeholder}
              </Box>
            )}
          </Droppable>
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
        pl: totalLeftPadding,
        pr: totalLeftPadding, // Symmetric padding
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
  const queryClient = useQueryClient();

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

  // Helper to deep clone tree data for optimistic updates
  const cloneTreeData = useCallback((data: CollectionTreeVO): CollectionTreeVO => {
    return structuredClone(data);
  }, []);

  // Handle drag end for reordering
  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination, type } = result;

    // Dropped outside a valid droppable
    if (!destination) return;

    // No movement
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // Get fresh data from query client to avoid stale closure issues
    const currentTreeData = queryClient.getQueryData<CollectionTreeVO>(['collections-tree']);
    if (!currentTreeData) return;

    // Clone the tree data for optimistic update
    const newTreeData = cloneTreeData(currentTreeData);

    // Helper to find and update children of a parent collection recursively
    const findAndUpdateChildren = (
      parentId: number,
      updateFn: (children: CollectionVO[]) => CollectionVO[]
    ): boolean => {
      const updateInCollections = (collections: CollectionVO[]): boolean => {
        for (const c of collections) {
          if (c.id === parentId) {
            c.children = updateFn(c.children);
            return true;
          }
          if (c.children && c.children.length > 0) {
            if (updateInCollections(c.children)) return true;
          }
        }
        return false;
      };

      for (const group of newTreeData.groups) {
        if (updateInCollections(group.collections)) return true;
      }
      return false;
    };

    let apiCall: (() => Promise<unknown>) | null = null;

    if (type === 'GROUP') {
      // Reordering groups - optimistic update
      const [movedGroup] = newTreeData.groups.splice(source.index, 1);
      newTreeData.groups.splice(destination.index, 0, movedGroup);

      const groupIds = newTreeData.groups.map(g => g.id);
      apiCall = () => CollectionApi.reorderGroups(groupIds);
    } else if (type === 'COLLECTION') {
      // Root-level collections in a group
      const droppableId = source.droppableId;
      const groupId = Number.parseInt(droppableId.replace('group-', ''), 10);
      const group = newTreeData.groups.find(g => g.id === groupId);

      if (!group) return;

      const [movedCollection] = group.collections.splice(source.index, 1);
      group.collections.splice(destination.index, 0, movedCollection);

      const collectionIds = group.collections.map(c => c.id);
      apiCall = () => CollectionApi.reorderCollections(collectionIds, null, groupId);
    } else if (type.startsWith('CHILDREN-')) {
      // Child collections under a parent
      const parentId = Number.parseInt(type.replace('CHILDREN-', ''), 10);

      const updated = findAndUpdateChildren(parentId, (children) => {
        const newChildren = Array.from(children);
        const [movedChild] = newChildren.splice(source.index, 1);
        newChildren.splice(destination.index, 0, movedChild);
        return newChildren;
      });

      if (!updated) return;

      // Find children again for API call
      let childIds: number[] = [];
      const findChildren = (collections: CollectionVO[]): CollectionVO[] | null => {
        for (const c of collections) {
          if (c.id === parentId) return c.children;
          if (c.children?.length) {
            const found = findChildren(c.children);
            if (found) return found;
          }
        }
        return null;
      };
      for (const group of newTreeData.groups) {
        const children = findChildren(group.collections);
        if (children) {
          childIds = children.map(c => c.id);
          break;
        }
      }

      apiCall = () => CollectionApi.reorderCollections(childIds, parentId, null);
    }

    if (!apiCall) return;

    // Apply optimistic update immediately
    queryClient.setQueryData(['collections-tree'], newTreeData);

    // Call API in background
    try {
      await apiCall();
    } catch (error) {
      console.error('Failed to reorder:', error);
      // Revert to original state on error
      queryClient.setQueryData(['collections-tree'], currentTreeData);
    }
  }, [queryClient, cloneTreeData]);

  if (!treeData) {
    return null;
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Box
        sx={{
          mt: 2,
          pt: 2,
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

        {/* Unsorted item with spacing */}
        <Box sx={{ mt: 0.5, mb: 0.5 }}>
          <UnsortedItem selectedNodeId={selectedNodeId} count={treeData.unsortedCount} />
        </Box>

        {/* Groups - Droppable container for reordering groups */}
        <Droppable droppableId="groups" type="GROUP">
          {(provided) => (
            <Box ref={provided.innerRef} {...provided.droppableProps}>
              {treeData.groups.map((group, groupIndex) => {
                // Default to expanded if not in state
                const isGroupExpanded = groupExpandedState[group.id] !== false;

                return (
                  <Draggable key={group.id} draggableId={`group-${group.id}`} index={groupIndex}>
                    {(dragProvided, snapshot) => (
                      <Box
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        sx={{
                          bgcolor: snapshot.isDragging ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                          borderRadius: '8px',
                          transition: snapshot.isDragging ? 'none' : 'background-color 0.15s ease',
                        }}
                      >
                        <Box {...dragProvided.dragHandleProps}>
                          <GroupHeader
                            group={group}
                            expanded={isGroupExpanded}
                            onToggle={() => handleToggleGroup(group.id)}
                            onContextMenu={onGroupContextMenu}
                          />
                        </Box>
                        <Collapse in={isGroupExpanded && !snapshot.isDragging} timeout={200}>
                          {/* Collections - Droppable container for each group */}
                          <Droppable droppableId={`group-${group.id}`} type="COLLECTION">
                            {(collProvided) => (
                              <Box
                                ref={collProvided.innerRef}
                                {...collProvided.droppableProps}
                                sx={{ minHeight: 4 }}
                              >
                                {group.collections.length === 0 ? (
                                  <Typography
                                    sx={{
                                      fontSize: '13px',
                                      color: 'rgba(156, 163, 175, 0.6)',
                                      fontStyle: 'italic',
                                      pl: totalLeftPadding,
                                      py: 0.75,
                                    }}
                                  >
                                    Empty
                                  </Typography>
                                ) : (
                                  group.collections.map((collection, collIndex) => (
                                    <Draggable
                                      key={collection.id}
                                      draggableId={`collection-${collection.id}`}
                                      index={collIndex}
                                    >
                                      {(collDragProvided, collSnapshot) => (
                                        <Box
                                          ref={collDragProvided.innerRef}
                                          {...collDragProvided.draggableProps}
                                          {...collDragProvided.dragHandleProps}
                                          sx={{
                                            bgcolor: collSnapshot.isDragging
                                              ? 'rgba(59, 130, 246, 0.08)'
                                              : 'transparent',
                                            borderRadius: '8px',
                                            transition: collSnapshot.isDragging
                                              ? 'none'
                                              : 'background-color 0.15s ease',
                                          }}
                                        >
                                          <CollectionItemContent
                                            collection={collection}
                                            selectedNodeId={selectedNodeId}
                                            level={0}
                                            onContextMenu={onCollectionContextMenu}
                                            collectionExpandedState={collectionExpandedState}
                                            onToggleCollection={handleToggleCollection}
                                          />
                                        </Box>
                                      )}
                                    </Draggable>
                                  ))
                                )}
                                {collProvided.placeholder}
                              </Box>
                            )}
                          </Droppable>
                        </Collapse>
                      </Box>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </Box>
          )}
        </Droppable>
      </Box>
    </DragDropContext>
  );
}
