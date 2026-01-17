import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import AddIcon from '@mui/icons-material/Add';
import { CollectionGroupVO } from '../../../api/collectionApi';

type GroupContextMenuProps = {
    contextMenu: {
        mouseX: number;
        mouseY: number;
        group: CollectionGroupVO;
    } | null;
    onClose: () => void;
    onEdit: (group: CollectionGroupVO) => void;
    onDelete: (group: CollectionGroupVO) => void;
    onAddCollection: (group: CollectionGroupVO) => void;
    onAddGroup?: () => void;
};

const GroupContextMenu: React.FC<GroupContextMenuProps> = ({
    contextMenu,
    onClose,
    onEdit,
    onDelete,
    onAddCollection,
    onAddGroup,
}) => {
    if (!contextMenu) {
        return null;
    }

    const hasCollections = contextMenu.group.collections && contextMenu.group.collections.length > 0;

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
                onClick={() => onAddCollection(contextMenu.group)}
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
                    primary="Add Collection"
                    primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}
                />
            </MenuItem>

            {onAddGroup && (
                <MenuItem
                    onClick={() => {
                        onClose();
                        onAddGroup();
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
                        <AddIcon sx={{ fontSize: 18, color: '#64748b' }} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Add Group"
                        primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}
                    />
                </MenuItem>
            )}

            <Divider sx={{ my: 0.5, mx: 1 }} />

            <MenuItem
                onClick={() => onEdit(contextMenu.group)}
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
                    primary="Rename Group"
                    primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}
                />
            </MenuItem>

            <MenuItem
                onClick={() => onDelete(contextMenu.group)}
                disabled={hasCollections}
                sx={{
                    fontSize: '13px',
                    py: 1,
                    px: 1.5,
                    borderRadius: '6px',
                    mx: 0.5,
                    color: hasCollections ? '#9ca3af' : '#dc2626',
                    '&:hover': {
                        bgcolor: hasCollections ? 'transparent' : 'rgba(220, 38, 38, 0.08)',
                    },
                    '&.Mui-disabled': {
                        opacity: 0.6,
                    },
                }}
            >
                <ListItemIcon sx={{ minWidth: 32 }}>
                    <DeleteIcon sx={{ fontSize: 18, color: hasCollections ? '#9ca3af' : '#dc2626' }} />
                </ListItemIcon>
                <ListItemText
                    primary={hasCollections ? "Delete (remove collections first)" : "Delete Group"}
                    primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}
                />
            </MenuItem>
        </Menu>
    );
};

export default GroupContextMenu;
