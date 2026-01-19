import { useSnackbar } from "notistack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Switch,
  IconButton,
  TextField,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Box,
  alpha,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { ArticleShortcut, ArticleShortcutControllerApiFactory } from "../../api";
import BoltIcon from '@mui/icons-material/Bolt';
import SettingSectionTitle from "./SettingSectionTitle";

const ArticleShortcutSetting = () => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [editShortcut, setEditShortcut] = useState<ArticleShortcut | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedShortcuts, setSelectedShortcuts] = useState<string[]>([]);

  // API client
  const api = ArticleShortcutControllerApiFactory();

  // Fetch all shortcuts
  const { data: shortcuts = [] } = useQuery<ArticleShortcut[]>(
    ["article-shortcuts"],
    async () => {
      const response = await api.getAllShortcutsUsingGET();
      return response.data;
    }
  );

  // Fetch importable default shortcuts
  const { data: importableShortcuts = [] } = useQuery<ArticleShortcut[]>(
    ["importable-shortcuts"],
    async () => {
      const response = await api.getImportableDefaultShortcutsUsingGET();
      return response.data;
    },
    {
      // Only fetch when import modal is open
      enabled: isImportModalOpen
    }
  );

  // Mutation for saving a shortcut
  const saveShortcutMutation = useMutation(
    async (shortcut: ArticleShortcut) => {
      try {
        if (shortcut.id) {
          const response = await api.updateShortcutUsingPUT(shortcut.id, shortcut);
          return response.data;
        } else {
          const response = await api.createShortcutUsingPOST(shortcut);
          return response.data;
        }
      } catch (error: any) {
        // Check if this is a name conflict error (HTTP 409 Conflict)
        if (error.response && error.response.status === 409) {
          throw new Error(error.response.data || "A shortcut with this name already exists");
        }
        throw error;
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["article-shortcuts"]);
        setIsEditModalOpen(false);
        enqueueSnackbar('Shortcut saved successfully', {
          variant: "success",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      },
      onError: (error: any) => {
        const errorMessage = error.message || "Failed to save shortcut";
        enqueueSnackbar(errorMessage, {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      }
    }
  );

  // Mutation for deleting a shortcut
  const deleteShortcutMutation = useMutation(
    async (id: number) => {
      await api.deleteShortcutUsingDELETE(id);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["article-shortcuts"]);
        enqueueSnackbar('Shortcut deleted successfully', {
          variant: "success",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      },
      onError: (error) => {
        enqueueSnackbar(`Failed to delete shortcut: ${error}`, {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      }
    }
  );

  // Mutation for importing default shortcuts
  const importShortcutsMutation = useMutation(
    async () => {
      const response = await api.importDefaultShortcutsUsingPOST();
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["article-shortcuts"]);
        setIsImportModalOpen(false);
        enqueueSnackbar('Default shortcuts imported successfully', {
          variant: "success",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      },
      onError: (error) => {
        enqueueSnackbar(`Failed to import shortcuts: ${error}`, {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      }
    }
  );

  // Mutation for importing selected shortcuts
  const importSelectedShortcutsMutation = useMutation(
    async (shortcutNames: string[]) => {
      // Use the generated API client
      const response = await api.importSelectedShortcutsUsingPOST(shortcutNames);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["article-shortcuts"]);
        setIsImportModalOpen(false);
        setSelectedShortcuts([]);
        enqueueSnackbar('Selected shortcuts imported successfully', {
          variant: "success",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      },
      onError: (error) => {
        enqueueSnackbar(`Failed to import shortcuts: ${error}`, {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      }
    }
  );

  // Mutation for batch updating shortcuts (after drag and drop)
  const updateShortcutOrderMutation = useMutation(
    async (updatedShortcuts: ArticleShortcut[]) => {
      try {
        const response = await api.saveShortcutsUsingPOST(updatedShortcuts);
        return response.data;
      } catch (error: any) {
        // Check if this is a name conflict error (HTTP 409 Conflict)
        if (error.response && error.response.status === 409) {
          throw new Error(error.response.data || "A shortcut with this name already exists");
        }
        throw error;
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["article-shortcuts"]);
      },
      onError: (error: any) => {
        const errorMessage = error.message || "Failed to update shortcut order";
        enqueueSnackbar(errorMessage, {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
        // Refresh to restore original order
        queryClient.invalidateQueries(["article-shortcuts"]);
      }
    }
  );

  // Mutation for toggling a shortcut's enabled status
  const toggleShortcutMutation = useMutation(
    async (shortcut: ArticleShortcut) => {
      const updatedShortcut = { ...shortcut, enabled: !shortcut.enabled };
      await api.updateShortcutUsingPUT(shortcut.id!, updatedShortcut);
      return updatedShortcut;
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(["article-shortcuts"]);
        const statusText = data.enabled ? "enabled" : "disabled";
        enqueueSnackbar(`Shortcut "${data.name}" ${statusText} successfully`, {
          variant: "success",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      },
      onError: (error) => {
        enqueueSnackbar(`Failed to update shortcut: ${error}`, {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      }
    }
  );

  const handleAddShortcut = () => {
    setEditShortcut({
      name: "",
      description: "",
      content: "",
      enabled: true,
      sortOrder: (shortcuts?.length || 0) + 1
    } as ArticleShortcut);
    setIsEditModalOpen(true);
  };

  const handleEditShortcut = (shortcut: ArticleShortcut) => {
    setEditShortcut({ ...shortcut });
    setIsEditModalOpen(true);
  };

  const handleDeleteShortcut = (id: number) => {
    if (window.confirm("Are you sure you want to delete this shortcut?")) {
      deleteShortcutMutation.mutate(id);
    }
  };

  const handleSaveShortcut = () => {
    if (!editShortcut || !editShortcut.name || !editShortcut.content) {
      enqueueSnackbar('Name and content are required', {
        variant: "error",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
      return;
    }

    saveShortcutMutation.mutate(editShortcut);
  };

  const handleToggleShortcut = (shortcut: ArticleShortcut) => {
    toggleShortcutMutation.mutate(shortcut);
  };

  const handleImportDefaults = () => {
    if (selectedShortcuts.length > 0) {
      importSelectedShortcutsMutation.mutate(selectedShortcuts);
    } else {
      importShortcutsMutation.mutate();
    }
  };

  const handleOpenImportModal = () => {
    setSelectedShortcuts([]);
    setIsImportModalOpen(true);
  };

  const handleToggleShortcutSelection = (name: string) => {
    setSelectedShortcuts(prev => {
      if (prev.includes(name)) {
        return prev.filter(shortcut => shortcut !== name);
      } else {
        return [...prev, name];
      }
    });
  };

  const handleSelectAllShortcuts = () => {
    if (selectedShortcuts.length === importableShortcuts.length) {
      setSelectedShortcuts([]);
    } else {
      setSelectedShortcuts(importableShortcuts.map(s => s.name!));
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(shortcuts || []);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update sort order
    const updatedItems = items.map((item, index) => ({
      ...item,
      sortOrder: index + 1
    }));

    // Optimistically update UI
    queryClient.setQueryData(["article-shortcuts"], updatedItems);

    // Send update to server
    updateShortcutOrderMutation.mutate(updatedItems);
  };

  return (
    <div>
      <SettingSectionTitle
        first
        icon={BoltIcon}
        description="Create AI-powered shortcuts to quickly process article content with custom prompts."
      >
        Article AI Shortcuts
      </SettingSectionTitle>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 3, mb: 2.5 }}>
        <Button
          startIcon={<DownloadIcon />}
          variant="outlined"
          size="small"
          onClick={handleOpenImportModal}
          sx={{
            borderRadius: 2,
            borderColor: '#e2e8f0',
            color: '#64748b',
            textTransform: 'none',
            fontWeight: 500,
            px: 2,
            '&:hover': {
              borderColor: '#3b82f6',
              color: '#3b82f6',
              bgcolor: alpha('#3b82f6', 0.04)
            }
          }}
        >
          Import Presets
        </Button>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          size="small"
          onClick={handleAddShortcut}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 500,
            px: 2,
            boxShadow: '0 1px 3px rgba(59,130,246,0.3)',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 4px 12px rgba(59,130,246,0.4)',
            }
          }}
        >
          Add Shortcut
        </Button>
      </Box>

      {/* Shortcut List */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="shortcuts">
          {(provided) => (
            <Box
              {...provided.droppableProps}
              ref={provided.innerRef}
              sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
            >
              {shortcuts?.map((shortcut, index) => (
                <Draggable
                  key={shortcut.id || `new-${index}`}
                  draggableId={shortcut.id?.toString() || `new-${index}`}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 2,
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: snapshot.isDragging ? '#3b82f6' : '#e2e8f0',
                        bgcolor: '#fff',
                        transition: 'all 0.15s ease-in-out',
                        opacity: shortcut.enabled ? 1 : 0.6,
                        '&:hover': {
                          borderColor: '#cbd5e1',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        },
                        ...(snapshot.isDragging && {
                          boxShadow: '0 8px 24px rgba(59,130,246,0.2)',
                        })
                      }}
                    >
                      {/* Drag Handle */}
                      <Box
                        {...provided.dragHandleProps}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          color: '#cbd5e1',
                          cursor: 'grab',
                          '&:hover': { color: '#94a3b8' },
                          '&:active': { cursor: 'grabbing' }
                        }}
                      >
                        <DragIndicatorIcon fontSize="small" />
                      </Box>

                      {/* Toggle Switch */}
                      <Tooltip title={shortcut.enabled ? "Disable shortcut" : "Enable shortcut"} arrow>
                        <Switch
                          size="small"
                          checked={shortcut.enabled}
                          onChange={() => handleToggleShortcut(shortcut)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: '#3b82f6',
                              '&:hover': { bgcolor: alpha('#3b82f6', 0.08) }
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              bgcolor: '#3b82f6'
                            }
                          }}
                        />
                      </Tooltip>

                      {/* Content */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body1"
                            sx={{
                              fontWeight: 600,
                              color: shortcut.enabled ? '#1e293b' : '#64748b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {shortcut.name}
                          </Typography>
                        </Box>
                        {shortcut.description && (
                          <Typography
                            variant="body2"
                            sx={{
                              color: '#94a3b8',
                              mt: 0.25,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {shortcut.description}
                          </Typography>
                        )}
                      </Box>

                      {/* Actions */}
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Edit shortcut" arrow>
                          <IconButton
                            size="small"
                            onClick={() => handleEditShortcut(shortcut)}
                            sx={{
                              color: '#94a3b8',
                              '&:hover': {
                                color: '#3b82f6',
                                bgcolor: alpha('#3b82f6', 0.08)
                              }
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete shortcut" arrow>
                          <IconButton
                            size="small"
                            onClick={() => shortcut.id && handleDeleteShortcut(shortcut.id)}
                            sx={{
                              color: '#94a3b8',
                              '&:hover': {
                                color: '#ef4444',
                                bgcolor: alpha('#ef4444', 0.08)
                              }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </Box>
          )}
        </Droppable>
      </DragDropContext>

      {/* Empty State */}
      {shortcuts?.length === 0 && (
        <Box
          sx={{
            textAlign: 'center',
            py: 6,
            px: 4,
            borderRadius: 3,
            border: '2px dashed #e2e8f0',
            bgcolor: '#f8fafc'
          }}
        >
          <BoltIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 500, mb: 1 }}>
            No shortcuts configured
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>
            Create custom AI shortcuts or import preset templates to get started.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
            <Button
              startIcon={<DownloadIcon />}
              variant="outlined"
              size="small"
              onClick={handleOpenImportModal}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 500
              }}
            >
              Import Presets
            </Button>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              size="small"
              onClick={handleAddShortcut}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 500,
                boxShadow: '0 1px 3px rgba(59,130,246,0.3)',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                }
              }}
            >
              Add Shortcut
            </Button>
          </Box>
        </Box>
      )}

      {/* Edit/Add Shortcut Dialog */}
      <Dialog
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)'
              }}
            >
              {editShortcut?.id ? <EditIcon sx={{ color: '#fff', fontSize: 20 }} /> : <AddIcon sx={{ color: '#fff', fontSize: 20 }} />}
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
              {editShortcut?.id ? "Edit Shortcut" : "Create New Shortcut"}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            <TextField
              fullWidth
              label="Name"
              value={editShortcut?.name || ""}
              onChange={(e) => setEditShortcut({ ...editShortcut!, name: e.target.value })}
              required
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                }
              }}
            />
            <TextField
              fullWidth
              label="Description"
              value={editShortcut?.description || ""}
              onChange={(e) => setEditShortcut({ ...editShortcut!, description: e.target.value })}
              size="small"
              placeholder="Brief description of what this shortcut does"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                }
              }}
            />
            <TextField
              fullWidth
              label="Prompt Content"
              value={editShortcut?.content || ""}
              onChange={(e) => setEditShortcut({ ...editShortcut!, content: e.target.value })}
              multiline
              rows={10}
              required
              placeholder="Enter the AI prompt that will be used to process article content..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                }
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Switch
                checked={editShortcut?.enabled || false}
                onChange={(e) => setEditShortcut({ ...editShortcut!, enabled: e.target.checked })}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#3b82f6',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    bgcolor: '#3b82f6'
                  }
                }}
              />
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Enable this shortcut
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button
            onClick={() => setIsEditModalOpen(false)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              color: '#64748b',
              px: 3
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveShortcut}
            variant="contained"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              boxShadow: '0 1px 3px rgba(59,130,246,0.3)',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              }
            }}
          >
            {editShortcut?.id ? "Save Changes" : "Create Shortcut"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Presets Dialog */}
      <Dialog
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
              }}
            >
              <DownloadIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
              Import Preset Shortcuts
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {importableShortcuts.length > 0 ? (
            <>
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                py: 1.5,
                px: 1,
                mb: 1,
                borderRadius: 2,
                bgcolor: '#f8fafc'
              }}>
                <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                  {selectedShortcuts.length} of {importableShortcuts.length} selected
                </Typography>
                <Button
                  size="small"
                  onClick={handleSelectAllShortcuts}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 500,
                    color: '#3b82f6'
                  }}
                >
                  {selectedShortcuts.length === importableShortcuts.length ? 'Deselect All' : 'Select All'}
                </Button>
              </Box>
              <List sx={{ py: 0 }}>
                {importableShortcuts.map((shortcut) => (
                  <ListItem
                    key={shortcut.name}
                    button
                    onClick={() => handleToggleShortcutSelection(shortcut.name!)}
                    sx={{
                      borderRadius: 2,
                      mb: 0.5,
                      border: '1px solid',
                      borderColor: selectedShortcuts.includes(shortcut.name!) ? alpha('#3b82f6', 0.3) : 'transparent',
                      bgcolor: selectedShortcuts.includes(shortcut.name!) ? alpha('#3b82f6', 0.04) : 'transparent',
                      '&:hover': {
                        bgcolor: alpha('#3b82f6', 0.08)
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Checkbox
                        edge="start"
                        checked={selectedShortcuts.includes(shortcut.name!)}
                        tabIndex={-1}
                        disableRipple
                        sx={{
                          color: '#cbd5e1',
                          '&.Mui-checked': { color: '#3b82f6' }
                        }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body1" sx={{ fontWeight: 500, color: '#1e293b' }}>
                          {shortcut.name}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                          {shortcut.description}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </>
          ) : (
            <Box
              sx={{
                textAlign: 'center',
                py: 6,
                color: '#94a3b8'
              }}
            >
              <DownloadIcon sx={{ fontSize: 48, color: '#e2e8f0', mb: 2 }} />
              <Typography variant="body1" sx={{ fontWeight: 500, color: '#64748b' }}>
                All presets already imported
              </Typography>
              <Typography variant="body2">
                No new preset shortcuts available.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button
            onClick={() => setIsImportModalOpen(false)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              color: '#64748b',
              px: 3
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImportDefaults}
            variant="contained"
            disabled={importableShortcuts.length === 0}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              boxShadow: '0 1px 3px rgba(59,130,246,0.3)',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              },
              '&.Mui-disabled': {
                background: '#e2e8f0',
                color: '#94a3b8'
              }
            }}
          >
            Import {selectedShortcuts.length > 0 ? `${selectedShortcuts.length} Selected` : 'All'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ArticleShortcutSetting; 