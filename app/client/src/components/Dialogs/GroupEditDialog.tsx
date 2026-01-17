import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
} from '@mui/material';
import { CollectionGroupVO } from '../../api/collectionApi';

interface GroupEditDialogProps {
    open: boolean;
    group: CollectionGroupVO | null; // null for creating new
    onClose: () => void;
    onSave: (name: string) => void;
}

const GroupEditDialog: React.FC<GroupEditDialogProps> = ({
    open,
    group,
    onClose,
    onSave,
}) => {
    const [name, setName] = useState('');

    useEffect(() => {
        if (open) {
            setName(group?.name || '');
        }
    }, [group, open]);

    const handleSave = () => {
        if (name.trim()) {
            onSave(name.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && name.trim()) {
            e.preventDefault();
            handleSave();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    const isEditing = group !== null;

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
                    {isEditing ? 'Rename Group' : 'New Group'}
                </Typography>
            </DialogTitle>
            <DialogContent sx={{ pt: 1.5, pb: 2 }}>
                <TextField
                    autoFocus
                    placeholder="Group name"
                    fullWidth
                    variant="outlined"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    InputProps={{
                        sx: {
                            borderRadius: '8px',
                            fontSize: '14px',
                            '& fieldset': {
                                borderColor: 'rgba(0,0,0,0.12)',
                            },
                            '&:hover fieldset': {
                                borderColor: 'rgba(59, 130, 246, 0.4) !important',
                            },
                            '&.Mui-focused fieldset': {
                                borderColor: '#3b82f6 !important',
                                borderWidth: '1px !important',
                            },
                        },
                    }}
                />
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
                    disabled={!name.trim()}
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

export default GroupEditDialog;
