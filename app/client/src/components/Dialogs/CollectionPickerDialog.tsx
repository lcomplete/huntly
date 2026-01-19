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
        return <Icon icon={icon} width={18} height={18} style={{ color }} />;
    }
    return <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>;
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

    const renderCollection = (collection: CollectionVO, level: number = 0, isLast: boolean = false) => {
        const isSelected = currentCollectionId === collection.id;
        const hasChildren = collection.children && collection.children.length > 0;
        const isExpanded = expandedCollections[collection.id];

        return (
            <React.Fragment key={collection.id}>
                <Box sx={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
                    {/* Tree lines */}
                    {level > 0 && (
                        <>
                            {/* Vertical line from parent */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    left: `${12 + (level - 1) * 24}px`,
                                    top: 0,
                                    bottom: isLast ? '50%' : 0,
                                    width: '1.5px',
                                    bgcolor: '#e5e7eb',
                                }}
                            />
                            {/* Horizontal line to item */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    left: `${12 + (level - 1) * 24}px`,
                                    top: '50%',
                                    width: '12px',
                                    height: '1.5px',
                                    bgcolor: '#e5e7eb',
                                }}
                            />
                        </>
                    )}
                    <ListItemButton
                        onClick={() => handleSelectCollection(collection.id)}
                        sx={{
                            ml: `${level * 24}px`,
                            pl: 1.5,
                            pr: 1.5,
                            py: 0.875,
                            borderRadius: '10px',
                            flex: 1,
                            bgcolor: isSelected 
                                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)'
                                : 'transparent',
                            background: isSelected 
                                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)'
                                : 'transparent',
                            boxShadow: isSelected ? '0 1px 3px rgba(59, 130, 246, 0.1)' : 'none',
                            '&:hover': { 
                                bgcolor: isSelected 
                                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.16) 0%, rgba(99, 102, 241, 0.12) 100%)'
                                    : 'rgba(0, 0, 0, 0.04)',
                                background: isSelected 
                                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.16) 0%, rgba(99, 102, 241, 0.12) 100%)'
                                    : 'rgba(0, 0, 0, 0.04)',
                            },
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    >
                        {hasChildren && (
                            <Box
                                onClick={(e) => { e.stopPropagation(); toggleCollection(collection.id); }}
                                sx={{ 
                                    mr: 0.5, 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#9ca3af',
                                    width: 20,
                                    height: 20,
                                    borderRadius: '4px',
                                    '&:hover': {
                                        bgcolor: 'rgba(0, 0, 0, 0.06)',
                                        color: '#6b7280',
                                    },
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {isExpanded ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
                            </Box>
                        )}
                        {!hasChildren && level > 0 && <Box sx={{ width: 20, mr: 0.5 }} />}
                        <ListItemIcon sx={{ minWidth: 32 }}>
                            <Box
                                sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0, 0, 0, 0.04)',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <CollectionIcon icon={collection.icon} selected={isSelected} />
                            </Box>
                        </ListItemIcon>
                        <ListItemText
                            primary={collection.name}
                            primaryTypographyProps={{
                                fontSize: '13.5px',
                                fontWeight: isSelected ? 600 : 500,
                                color: isSelected ? '#3b82f6' : '#374151',
                                sx: { 
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }
                            }}
                        />
                        {isSelected && (
                            <Box
                                sx={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    bgcolor: '#3b82f6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    ml: 1,
                                    flexShrink: 0,
                                }}
                            >
                                <CheckIcon sx={{ fontSize: 12, color: '#fff' }} />
                            </Box>
                        )}
                    </ListItemButton>
                </Box>
                {hasChildren && (
                    <Collapse in={isExpanded}>
                        {collection.children!.map((child, idx) => 
                            renderCollection(child, level + 1, idx === collection.children!.length - 1)
                        )}
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
                    borderRadius: '16px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                    border: '1px solid rgba(0, 0, 0, 0.05)',
                    maxHeight: '70vh',
                    overflow: 'hidden',
                },
            }}
        >
            <DialogTitle sx={{ pb: 1, pt: 2.5, px: 2.5 }}>
                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}>
                    Move to Collection
                </Typography>
            </DialogTitle>
            <DialogContent sx={{ pt: 1, pb: 2.5, px: 1.5 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress size={28} sx={{ color: '#3b82f6' }} />
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {/* Unsorted option */}
                        <ListItemButton
                            onClick={() => handleSelectCollection(null)}
                            sx={{
                                py: 0.875,
                                px: 1.5,
                                mx: 0.5,
                                borderRadius: '10px',
                                bgcolor: currentCollectionId === null 
                                    ? 'rgba(59, 130, 246, 0.1)'
                                    : 'transparent',
                                '&:hover': { 
                                    bgcolor: currentCollectionId === null 
                                        ? 'rgba(59, 130, 246, 0.14)'
                                        : 'rgba(0, 0, 0, 0.04)',
                                },
                                transition: 'all 0.15s ease',
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                                <Box
                                    sx={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        bgcolor: currentCollectionId === null 
                                            ? 'rgba(59, 130, 246, 0.15)' 
                                            : 'rgba(0, 0, 0, 0.05)',
                                    }}
                                >
                                    <InboxOutlinedIcon sx={{ 
                                        fontSize: 16, 
                                        color: currentCollectionId === null ? '#3b82f6' : '#6b7280' 
                                    }} />
                                </Box>
                            </ListItemIcon>
                            <ListItemText
                                primary="Unsorted"
                                primaryTypographyProps={{
                                    fontSize: '13.5px',
                                    fontWeight: currentCollectionId === null ? 600 : 500,
                                    color: currentCollectionId === null ? '#3b82f6' : '#374151',
                                }}
                            />
                            {currentCollectionId === null && (
                                <Box
                                    sx={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: '50%',
                                        bgcolor: '#3b82f6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <CheckIcon sx={{ fontSize: 11, color: '#fff' }} />
                                </Box>
                            )}
                        </ListItemButton>

                        {/* Groups and collections */}
                        {treeData?.groups.map((group) => (
                            <Box key={group.id}>
                                {/* Group header */}
                                <Box
                                    onClick={() => toggleGroup(group.id)}
                                    sx={{ 
                                        display: 'flex',
                                        alignItems: 'center',
                                        px: 2,
                                        py: 1,
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        '&:hover': {
                                            '& .group-toggle': {
                                                bgcolor: 'rgba(0, 0, 0, 0.08)',
                                            }
                                        },
                                    }}
                                >
                                    <Box
                                        className="group-toggle"
                                        sx={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: '5px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            bgcolor: 'rgba(0, 0, 0, 0.04)',
                                            mr: 1,
                                            transition: 'background-color 0.15s ease',
                                        }}
                                    >
                                        {expandedGroups[group.id] ? 
                                            <ExpandMoreIcon sx={{ fontSize: 14, color: '#6b7280' }} /> : 
                                            <ChevronRightIcon sx={{ fontSize: 14, color: '#6b7280' }} />
                                        }
                                    </Box>
                                    <Typography sx={{ 
                                        fontSize: '11.5px', 
                                        fontWeight: 600, 
                                        color: '#6b7280', 
                                        textTransform: 'uppercase', 
                                        letterSpacing: '0.06em',
                                        flex: 1,
                                    }}>
                                        {group.name}
                                    </Typography>
                                    <Box
                                        sx={{
                                            px: 1,
                                            py: 0.25,
                                            borderRadius: '6px',
                                            bgcolor: 'rgba(0, 0, 0, 0.04)',
                                        }}
                                    >
                                        <Typography sx={{ 
                                            fontSize: '11px', 
                                            fontWeight: 600, 
                                            color: '#9ca3af', 
                                        }}>
                                            {group.collections.length}
                                        </Typography>
                                    </Box>
                                </Box>
                                {/* Collections list */}
                                <Collapse in={expandedGroups[group.id]}>
                                    <Box
                                        sx={{
                                            mx: 1,
                                            mb: 0.5,
                                            p: 1,
                                            bgcolor: '#fafbfc',
                                            borderRadius: '12px',
                                            border: '1px solid #f0f1f3',
                                        }}
                                    >
                                        <List dense disablePadding>
                                            {group.collections.map((c, idx) => 
                                                renderCollection(c, 0, idx === group.collections.length - 1)
                                            )}
                                        </List>
                                    </Box>
                                </Collapse>
                            </Box>
                        ))}
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default CollectionPickerDialog;
