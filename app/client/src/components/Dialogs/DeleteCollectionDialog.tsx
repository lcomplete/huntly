import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Checkbox,
    FormControlLabel,
} from '@mui/material';
import { CollectionVO, CollectionApi } from '../../api/collectionApi';

interface DeleteCollectionDialogProps {
    open: boolean;
    collection: CollectionVO | null;
    onClose: () => void;
    onConfirm: (deletePages: boolean) => void;
}

const DeleteCollectionDialog: React.FC<DeleteCollectionDialogProps> = ({
    open,
    collection,
    onClose,
    onConfirm,
}) => {
    const [deletePages, setDeletePages] = useState(false);
    const [pageCount, setPageCount] = useState<number>(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && collection) {
            setDeletePages(false);
            setLoading(true);
            CollectionApi.getPageCount(collection.id)
                .then((count) => setPageCount(count))
                .catch(() => setPageCount(collection.pageCount || 0))
                .finally(() => setLoading(false));
        }
    }, [open, collection]);

    const handleConfirm = () => {
        onConfirm(deletePages);
    };

    if (!collection) {
        return null;
    }

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
                    Delete Collection
                </Typography>
            </DialogTitle>
            <DialogContent sx={{ pt: 1.5, pb: 2 }}>
                <Typography sx={{ color: '#4b5563', fontSize: '14px', mb: 2 }}>
                    Are you sure you want to delete <strong>"{collection.name}"</strong>?
                </Typography>

                {pageCount > 0 && (
                    <Box
                        sx={{
                            p: 1.5,
                            bgcolor: 'rgba(251, 191, 36, 0.1)',
                            borderRadius: '8px',
                            mb: 2,
                            border: '1px solid rgba(251, 191, 36, 0.3)',
                        }}
                    >
                        <Typography sx={{ fontSize: '13px', color: '#92400e', fontWeight: 500 }}>
                            This collection contains {pageCount} page{pageCount !== 1 ? 's' : ''}.
                        </Typography>
                    </Box>
                )}

                <FormControlLabel
                    control={
                        <Checkbox
                            checked={deletePages}
                            onChange={(e) => setDeletePages(e.target.checked)}
                            size="small"
                            sx={{
                                color: '#9ca3af',
                                '&.Mui-checked': { color: '#dc2626' },
                            }}
                        />
                    }
                    label={
                        <Typography sx={{ fontSize: '13px', color: '#4b5563' }}>
                            Also delete all pages in this collection
                        </Typography>
                    }
                />

                {!deletePages && pageCount > 0 && (
                    <Typography sx={{ fontSize: '12px', color: '#9ca3af', mt: 0.5, ml: 3.5 }}>
                        Pages will be moved to "Unsorted"
                    </Typography>
                )}
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
                    onClick={handleConfirm}
                    variant="contained"
                    disabled={loading}
                    sx={{
                        bgcolor: '#dc2626',
                        fontWeight: 600,
                        px: 2.5,
                        py: 0.625,
                        borderRadius: '6px',
                        textTransform: 'none',
                        fontSize: '13px',
                        boxShadow: 'none',
                        '&:hover': {
                            bgcolor: '#b91c1c',
                            boxShadow: 'none',
                        },
                        '&:disabled': {
                            bgcolor: '#e5e7eb',
                            color: '#9ca3af',
                        },
                    }}
                >
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DeleteCollectionDialog;
