import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Typography,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Collapse,
    CircularProgress,
} from '@mui/material';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckIcon from '@mui/icons-material/Check';
import { Icon } from '@iconify/react';
import { CollectionApi, CollectionTreeVO, CollectionVO } from '../../api/collectionApi';

interface CollectionPickerDialogProps {
    open: boolean;
    currentCollectionId?: number | null;
    onClose: () => void;
    onSelect: (collectionId: number | null) => void;
}

// Render collection icon (emoji or iconify)
const CollectionIcon: React.FC<{ icon?: string | null; selected?: boolean }> = ({ icon, selected }) => {
    const color = selected ? '#3b82f6' : '#64748b';
    
    if (!icon) {
        return <FolderOutlinedIcon sx={{ fontSize: 18, color }} />;
    }
    if (icon.includes(':')) {
        return <Icon icon={icon} width={18} height={18} />;
    }
    return <span style={{ fontSize: 16 }}>{icon}</span>;
};

const CollectionPickerDialog: React.FC<CollectionPickerDialogProps> = ({
    open,
    currentCollectionId,
    onClose,
    onSelect,
}) => {
    const [treeData, setTreeData] = useState<CollectionTreeVO | null>(null);
    const [loading, setLoading] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
    const [expandedCollections, setExpandedCollections] = useState<Record<number, boolean>>({});

    useEffect(() => {
        if (open) {
            setLoading(true);
            CollectionApi.getTree()
                .then(data => {
                    setTreeData(data);
                    // Expand all groups by default
                    const groups: Record<number, boolean> = {};
                    data.groups.forEach(g => { groups[g.id] = true; });
                    setExpandedGroups(groups);
                })
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [open]);

    const handleSelectCollection = (collectionId: number | null) => {
        onSelect(collectionId);
        onClose();
    };

    const toggleGroup = (groupId: number) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const toggleCollection = (collId: number) => {
        setExpandedCollections(prev => ({ ...prev, [collId]: !prev[collId] }));
    };

    const renderCollection = (collection: CollectionVO, level: number = 0) => {
        const isSelected = currentCollectionId === collection.id;
        const hasChildren = collection.children && collection.children.length > 0;
        const isExpanded = expandedCollections[collection.id];

        return (
            <React.Fragment key={collection.id}>
                <ListItemButton
                    onClick={() => handleSelectCollection(collection.id)}
                    sx={{
                        pl: 2 + level * 2,
                        py: 0.75,
                        borderRadius: '6px',
                        mx: 0.5,
                        mb: 0.25,
                        bgcolor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        '&:hover': { bgcolor: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'rgba(0,0,0,0.04)' },
                    }}
                >
                    {hasChildren && (
                        <Box
                            onClick={(e) => { e.stopPropagation(); toggleCollection(collection.id); }}
                            sx={{ mr: 0.5, display: 'flex', cursor: 'pointer' }}
                        >
                            {isExpanded ? <ExpandMoreIcon sx={{ fontSize: 18 }} /> : <ChevronRightIcon sx={{ fontSize: 18 }} />}
                        </Box>
                    )}
                    <ListItemIcon sx={{ minWidth: 28 }}>
                        <CollectionIcon icon={collection.icon} selected={isSelected} />
                    </ListItemIcon>
                    <ListItemText
                        primary={collection.name}
                        primaryTypographyProps={{
                            fontSize: '13px',
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? '#3b82f6' : '#374151',
                        }}
                    />
                    {isSelected && <CheckIcon sx={{ fontSize: 16, color: '#3b82f6' }} />}
                </ListItemButton>
                {hasChildren && (
                    <Collapse in={isExpanded}>
                        {collection.children!.map(child => renderCollection(child, level + 1))}
                    </Collapse>
                )}
            </React.Fragment>
        );
    };

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
                    maxHeight: '70vh',
                },
            }}
        >
            <DialogTitle sx={{ pb: 1, pt: 2.5 }}>
                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
                    Move to Collection
                </Typography>
            </DialogTitle>
            <DialogContent sx={{ pt: 1, pb: 2, px: 1 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : (
                    <List dense sx={{ py: 0 }}>
                        {/* Unsorted option */}
                        <ListItemButton
                            onClick={() => handleSelectCollection(null)}
                            sx={{
                                py: 0.75,
                                borderRadius: '6px',
                                mx: 0.5,
                                mb: 0.5,
                                bgcolor: currentCollectionId === null ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                '&:hover': { bgcolor: currentCollectionId === null ? 'rgba(59, 130, 246, 0.12)' : 'rgba(0,0,0,0.04)' },
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 28 }}>
                                <InboxOutlinedIcon sx={{ fontSize: 18, color: currentCollectionId === null ? '#3b82f6' : '#64748b' }} />
                            </ListItemIcon>
                            <ListItemText
                                primary="Unsorted"
                                primaryTypographyProps={{
                                    fontSize: '13px',
                                    fontWeight: currentCollectionId === null ? 600 : 500,
                                    color: currentCollectionId === null ? '#3b82f6' : '#374151',
                                }}
                            />
                            {currentCollectionId === null && <CheckIcon sx={{ fontSize: 16, color: '#3b82f6' }} />}
                        </ListItemButton>

                        {/* Groups and collections */}
                        {treeData?.groups.map(group => (
                            <React.Fragment key={group.id}>
                                <ListItemButton
                                    onClick={() => toggleGroup(group.id)}
                                    sx={{ py: 0.5, borderRadius: '6px', mx: 0.5, mt: 0.5 }}
                                >
                                    {expandedGroups[group.id] ? <ExpandMoreIcon sx={{ fontSize: 16, mr: 0.5 }} /> : <ChevronRightIcon sx={{ fontSize: 16, mr: 0.5 }} />}
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                        {group.name}
                                    </Typography>
                                </ListItemButton>
                                <Collapse in={expandedGroups[group.id]}>
                                    {group.collections.map(c => renderCollection(c))}
                                </Collapse>
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default CollectionPickerDialog;

