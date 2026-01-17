import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
} from '@mui/material';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import { CollectionVO } from '../../api/collectionApi';
import IconPicker, { IconValue } from '../IconPicker';

interface CollectionEditDialogProps {
    open: boolean;
    collection: CollectionVO | null; // null for creating new
    siblingNames?: string[]; // names of sibling collections (same parent/group)
    onClose: () => void;
    onSave: (name: string, icon?: string, color?: string) => void;
}

const CollectionEditDialog: React.FC<CollectionEditDialogProps> = ({
    open,
    collection,
    siblingNames = [],
    onClose,
    onSave,
}) => {
    const [name, setName] = useState('');
    const [icon, setIcon] = useState<IconValue | null>(null);

    useEffect(() => {
        if (open) {
            setName(collection?.name || '');
            // Convert old string format to new IconValue format
            if (collection?.icon) {
                // Check if it's an iconify icon (contains colon like 'flat-color-icons:folder')
                if (collection.icon.includes(':')) {
                    setIcon({ type: 'icon', value: collection.icon });
                } else {
                    // It's an emoji
                    setIcon({ type: 'emoji', value: collection.icon });
                }
            } else {
                setIcon(null);
            }
        }
    }, [collection, open]);

    // Check for duplicate name among siblings
    const isDuplicateName = useMemo(() => {
        const trimmedName = name.trim().toLowerCase();
        if (!trimmedName) return false;
        // When editing, exclude current collection's original name
        const currentName = collection?.name?.toLowerCase();
        return siblingNames.some(
            siblingName => siblingName.toLowerCase() === trimmedName && siblingName.toLowerCase() !== currentName
        );
    }, [name, siblingNames, collection?.name]);

    const handleSave = () => {
        if (name.trim() && !isDuplicateName) {
            // Convert IconValue back to string for API
            // Both emoji and iconify icon names are stored in the icon field
            const iconStr = icon?.value;
            onSave(name.trim(), iconStr, undefined);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && name.trim() && !isDuplicateName) {
            e.preventDefault();
            handleSave();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    const isEditing = collection !== null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                },
            }}
        >
            <DialogTitle sx={{ pb: 1.5, pt: 2.5 }}>
                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
                    {isEditing ? 'Edit Collection' : 'New Collection'}
                </Typography>
            </DialogTitle>
            <DialogContent sx={{ pt: 1.5, pb: 2 }}>
                {/* Icon row */}
                <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#64748b', mb: 1 }}>
                        Icon
                    </Typography>
                    <IconPicker
                        value={icon}
                        onChange={setIcon}
                        defaultIcon={<FolderOutlinedIcon sx={{ fontSize: 20 }} />}
                        size="large"
                    />
                </Box>

                {/* Name row */}
                <Box>
                    <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#64748b', mb: 1 }}>
                        Name
                    </Typography>
                    <TextField
                        autoFocus
                        placeholder="Collection name"
                        fullWidth
                        variant="outlined"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        error={isDuplicateName}
                        helperText={isDuplicateName ? 'A collection with this name already exists' : ''}
                        InputProps={{
                            sx: {
                                borderRadius: '8px',
                                fontSize: '14px',
                                '& fieldset': {
                                    borderColor: isDuplicateName ? '#ef4444' : 'rgba(0,0,0,0.12)',
                                },
                                '&:hover fieldset': {
                                    borderColor: isDuplicateName ? '#ef4444 !important' : 'rgba(59, 130, 246, 0.4) !important',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: isDuplicateName ? '#ef4444 !important' : '#3b82f6 !important',
                                    borderWidth: '1px !important',
                                },
                            },
                        }}
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 2.5, pb: 2, gap: 0.75 }}>
                <Button
                    onClick={onClose}
                    sx={{
                        color: '#64748b',
                        fontWeight: 500,
                        px: 2,
                        py: 0.625,
                        borderRadius: '6px',
                        fontSize: '13px',
                        textTransform: 'none',
                        '&:hover': {
                            bgcolor: 'rgba(0,0,0,0.04)',
                        },
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={!name.trim() || isDuplicateName}
                    sx={{
                        bgcolor: '#3b82f6',
                        fontWeight: 600,
                        px: 2.5,
                        py: 0.625,
                        borderRadius: '6px',
                        textTransform: 'none',
                        fontSize: '13px',
                        boxShadow: 'none',
                        '&:hover': {
                            bgcolor: '#2563eb',
                            boxShadow: 'none',
                        },
                        '&:disabled': {
                            bgcolor: '#e5e7eb',
                            color: '#9ca3af',
                        },
                    }}
                >
                    {isEditing ? 'Save' : 'Create'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CollectionEditDialog;
