import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { Folder } from '../../../api';

type FolderContextMenuProps = {
  contextMenu: {
    mouseX: number;
    mouseY: number;
    folder: Folder;
  } | null;
  onClose: () => void;
  onEdit: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
};

const FolderContextMenu: React.FC<FolderContextMenuProps> = ({
  contextMenu,
  onClose,
  onEdit,
  onDelete,
}) => {
  if (!contextMenu) {
    return null;
  }

  return (
    <Menu
      open={contextMenu !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        contextMenu !== null
          ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
          : undefined
      }
      PaperProps={{
        sx: {
          minWidth: 180,
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          borderRadius: '10px',
          border: '1px solid rgba(0,0,0,0.06)',
          py: 0.5,
        },
      }}
      MenuListProps={{
        sx: { py: 0 },
      }}
    >
      <MenuItem
        onClick={() => {
          onEdit(contextMenu.folder);
          onClose();
        }}
        sx={{
          fontSize: '13px',
          py: 1,
          px: 1.5,
          borderRadius: '6px',
          mx: 0.5,
          '&:hover': {
            bgcolor: 'rgba(59, 130, 246, 0.08)',
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          <EditIcon sx={{ fontSize: 18, color: '#64748b' }} />
        </ListItemIcon>
        <ListItemText
          primary="Edit"
          primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}
        />
      </MenuItem>

      <Divider sx={{ my: 0.5, mx: 1 }} />

      <MenuItem
        onClick={() => {
          onDelete(contextMenu.folder);
          onClose();
        }}
        sx={{
          fontSize: '13px',
          py: 1,
          px: 1.5,
          borderRadius: '6px',
          mx: 0.5,
          color: '#dc2626',
          '&:hover': {
            bgcolor: 'rgba(220, 38, 38, 0.08)',
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          <DeleteIcon sx={{ fontSize: 18, color: '#dc2626' }} />
        </ListItemIcon>
        <ListItemText
          primary="Delete"
          primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}
        />
      </MenuItem>
    </Menu>
  );
};

export default FolderContextMenu;

