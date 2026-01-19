import React, { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useSnackbar } from "notistack";
import { IconButton, Tooltip } from "@mui/material";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import AddIcon from "@mui/icons-material/Add";
import FilterListIcon from "@mui/icons-material/FilterList";
import { ConnectorControllerApiFactory, ConnectorItem, Folder, SettingControllerApiFactory } from "../../../api";
import SidebarHeader from "../shared/SidebarHeader";
import FeedsNavTree from "./FeedsNavTree";
import FolderContextMenu from "./FolderContextMenu";
import FeedContextMenu from "./FeedContextMenu";
import FolderFormDialog from "../../SettingModal/FolderFormDialog";
import FeedsFormDialog from "../../SettingModal/FeedsFormDialog";
import DeleteConfirmDialog from "../../DeleteConfirmDialog";
import SubscribeFeedDialog from "./SubscribeFeedDialog";

// Storage key for unread filter state
const STORAGE_KEY_UNREAD_FILTER = 'huntly-feeds-unread-filter';

function sumInboxCount(connectorItems: Array<ConnectorItem> | undefined) {
  if (!connectorItems) return 0;
  return connectorItems.reduce((sum, cur) => sum + (cur.inboxCount || 0), 0);
}

const FeedsNav: React.FC = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const api = SettingControllerApiFactory();

  const { data: view } = useQuery(
    ['folder-connector-view'],
    async () => (await ConnectorControllerApiFactory().getFolderConnectorViewUsingGET()).data,
    {
      refetchInterval: 5000,
    }
  );

  // Context menu states
  const [folderContextMenu, setFolderContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    folder: Folder;
  } | null>(null);

  const [feedContextMenu, setFeedContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    feed: ConnectorItem;
  } | null>(null);

  // Dialog states
  const [editFolderId, setEditFolderId] = useState<number | null>(null);
  const [editFeedId, setEditFeedId] = useState<number | null>(null);
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<Folder | null>(null);
  const [deleteFeedConfirm, setDeleteFeedConfirm] = useState<ConnectorItem | null>(null);
  const [subscribeDialogOpen, setSubscribeDialogOpen] = useState(false);

  // Filter state - persisted to localStorage
  const [showUnreadOnly, setShowUnreadOnly] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_UNREAD_FILTER) === 'true';
    } catch {
      return false;
    }
  });

  const toggleUnreadFilter = useCallback(() => {
    setShowUnreadOnly((prev) => {
      const newValue = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_UNREAD_FILTER, String(newValue));
      } catch {
        // Ignore storage errors
      }
      return newValue;
    });
  }, []);

  // Context menu handlers
  const handleFolderContextMenu = useCallback((event: React.MouseEvent, folder: Folder) => {
    event.preventDefault();
    setFolderContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      folder,
    });
  }, []);

  const handleFeedContextMenu = useCallback((event: React.MouseEvent, feed: ConnectorItem) => {
    event.preventDefault();
    setFeedContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      feed,
    });
  }, []);

  // Edit handlers
  const handleEditFolder = useCallback((folder: Folder) => {
    setEditFolderId(folder.id || 0);
  }, []);

  const handleEditFeed = useCallback((feed: ConnectorItem) => {
    setEditFeedId(feed.id || 0);
  }, []);

  // Delete handlers
  const handleDeleteFolder = useCallback((folder: Folder) => {
    setDeleteFolderConfirm(folder);
  }, []);

  const handleDeleteFeed = useCallback((feed: ConnectorItem) => {
    setDeleteFeedConfirm(feed);
  }, []);

  const confirmDeleteFolder = useCallback(async () => {
    if (!deleteFolderConfirm?.id) return;
    try {
      await api.deleteFolderUsingPOST(deleteFolderConfirm.id);
      enqueueSnackbar('Folder deleted.', {
        variant: 'success',
        anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
      });
      queryClient.invalidateQueries(['folder-connector-view']);
    } catch (err) {
      console.error('Failed to delete folder:', err);
      enqueueSnackbar('Failed to delete folder.', {
        variant: 'error',
        anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
      });
    }
    setDeleteFolderConfirm(null);
  }, [deleteFolderConfirm, api, enqueueSnackbar, queryClient]);

  const confirmDeleteFeed = useCallback(async () => {
    if (!deleteFeedConfirm?.id) return;
    try {
      await api.deleteFeedUsingPOST(deleteFeedConfirm.id);
      enqueueSnackbar('Feed deleted.', {
        variant: 'success',
        anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
      });
      queryClient.invalidateQueries(['folder-connector-view']);
    } catch (err) {
      console.error('Failed to delete feed:', err);
      enqueueSnackbar('Failed to delete feed.', {
        variant: 'error',
        anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
      });
    }
    setDeleteFeedConfirm(null);
  }, [deleteFeedConfirm, api, enqueueSnackbar, queryClient]);

  // Calculate all inbox count
  const allInboxCount = view?.folderFeedConnectors?.reduce(
    (sum, fc) => sum + sumInboxCount(fc.connectorItems),
    0
  ) || 0;

  // Create new folder action
  const handleCreateFolder = useCallback(() => {
    setEditFolderId(0); // 0 means create new
  }, []);

  // Open subscribe dialog
  const handleOpenSubscribe = useCallback(() => {
    setSubscribeDialogOpen(true);
  }, []);

  const iconButtonStyle = {
    width: 24,
    height: 24,
    bgcolor: 'transparent',
    borderRadius: '5px',
    transition: 'color 0.15s ease',
    color: '#94a3b8',
    mr: 0.5,
    '&:hover': {
      color: '#64748b',
    },
  };

  return (
    <>
      <SidebarHeader
        title="Feeds"
        actionLink="/settings/feeds"
        extraActions={
          <>
            <Tooltip title={showUnreadOnly ? "Show All" : "Show Unread Only"}>
              <IconButton
                size="small"
                onClick={toggleUnreadFilter}
                sx={{
                  ...iconButtonStyle,
                  color: showUnreadOnly ? '#3b82f6' : '#94a3b8',
                }}
              >
                <FilterListIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="New Folder">
              <IconButton size="small" onClick={handleCreateFolder} sx={iconButtonStyle}>
                <CreateNewFolderOutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Subscribe to RSS">
              <IconButton size="small" onClick={handleOpenSubscribe} sx={iconButtonStyle}>
                <AddIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          </>
        }
      />
      {view?.folderFeedConnectors && view.folderFeedConnectors.length > 0 && (
        <FeedsNavTree
          folderConnectors={view.folderFeedConnectors}
          selectedNodeId={location.pathname}
          allInboxCount={allInboxCount}
          showUnreadOnly={showUnreadOnly}
          onFolderContextMenu={handleFolderContextMenu}
          onFeedContextMenu={handleFeedContextMenu}
        />
      )}

      {/* Context menus */}
      <FolderContextMenu
        contextMenu={folderContextMenu}
        onClose={() => setFolderContextMenu(null)}
        onEdit={handleEditFolder}
        onDelete={handleDeleteFolder}
      />
      <FeedContextMenu
        contextMenu={feedContextMenu}
        onClose={() => setFeedContextMenu(null)}
        onEdit={handleEditFeed}
        onDelete={handleDeleteFeed}
      />

      {/* Edit dialogs */}
      {editFolderId !== null && (
        <FolderFormDialog
          folderId={editFolderId}
          onClose={() => {
            setEditFolderId(null);
            queryClient.invalidateQueries(['folder-connector-view']);
          }}
        />
      )}
      {editFeedId !== null && (
        <FeedsFormDialog
          feedsId={editFeedId}
          onClose={() => {
            setEditFeedId(null);
            queryClient.invalidateQueries(['folder-connector-view']);
          }}
        />
      )}

      {/* Delete confirmation dialogs */}
      <DeleteConfirmDialog
        open={deleteFolderConfirm !== null}
        title="Delete Folder"
        content={`Feeds under folder "${deleteFolderConfirm?.name}" will move to root folder. Do you want to delete it?`}
        onConfirm={confirmDeleteFolder}
        onCancel={() => setDeleteFolderConfirm(null)}
      />
      <DeleteConfirmDialog
        open={deleteFeedConfirm !== null}
        title="Delete Feed"
        content={`Articles in library will not be deleted. Do you want to delete this feed "${deleteFeedConfirm?.name}"?`}
        onConfirm={confirmDeleteFeed}
        onCancel={() => setDeleteFeedConfirm(null)}
      />

      {/* Subscribe dialog */}
      <SubscribeFeedDialog
        open={subscribeDialogOpen}
        onClose={() => setSubscribeDialogOpen(false)}
      />
    </>
  );
};

export default FeedsNav;

