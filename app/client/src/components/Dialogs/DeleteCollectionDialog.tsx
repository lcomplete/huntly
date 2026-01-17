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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
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
                    borderRadius: '16px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                },
            }}
        >
            <DialogTitle sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '10px',
                            bgcolor: '#fef2f2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <DeleteOutlineIcon sx={{ color: '#dc2626', fontSize: 22 }} />
                    </Box>
                    <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>
                        Delete Collection
                    </Typography>
                </Box>
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
                <Typography sx={{ color: '#4b5563', fontSize: '14px', mb: 2 }}>
                    Are you sure you want to delete <strong>"{collection.name}"</strong>?
                </Typography>

                {pageCount > 0 && (
                    <Box
                        sx={{
                            p: 2,
                            bgcolor: '#fef3c7',
                            borderRadius: '10px',
                            mb: 2,
                            border: '1px solid #fcd34d',
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
                    <Typography sx={{ fontSize: '12px', color: '#9ca3af', mt: 0.5, ml: 4 }}>
                        Pages will be moved to "Unsorted"
                    </Typography>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
                <Button
                    onClick={onClose}
                    sx={{
                        color: '#64748b',
                        fontWeight: 500,
                        px: 2,
                        borderRadius: '8px',
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
                        px: 3,
                        borderRadius: '8px',
                        textTransform: 'none',
                        fontSize: '14px',
                        boxShadow: 'none',
                        '&:hover': {
                            bgcolor: '#b91c1c',
                            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
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
