import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import { CollectionVO } from '../../../api/collectionApi';

type CollectionContextMenuProps = {
    contextMenu: {
        mouseX: number;
        mouseY: number;
        collection: CollectionVO;
    } | null;
    onClose: () => void;
    onEdit: (collection: CollectionVO) => void;
    onDelete: (collection: CollectionVO) => void;
    onAddSubCollection: (collection: CollectionVO) => void;
};

const CollectionContextMenu: React.FC<CollectionContextMenuProps> = ({
    contextMenu,
    onClose,
    onEdit,
    onDelete,
    onAddSubCollection,
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
                onClick={() => onEdit(contextMenu.collection)}
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

            <MenuItem
                onClick={() => onAddSubCollection(contextMenu.collection)}
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
                    <CreateNewFolderIcon sx={{ fontSize: 18, color: '#64748b' }} />
                </ListItemIcon>
                <ListItemText
                    primary="Add Sub-collection"
                    primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}
                />
            </MenuItem>

            <Divider sx={{ my: 0.5, mx: 1 }} />

            <MenuItem
                onClick={() => onDelete(contextMenu.collection)}
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

export default CollectionContextMenu;
