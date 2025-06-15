import {useSnackbar} from "notistack";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {Button, Switch, Divider, FormControlLabel, IconButton, TextField, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText, ListItemIcon, Chip} from "@mui/material";
import React, {useState} from "react";
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import Typography from "@mui/material/Typography";
import {DragDropContext, Droppable, Draggable} from "react-beautiful-dnd";
import {ArticleShortcut, ArticleShortcutControllerApiFactory} from "../../api";

const ArticleShortcutSetting = () => {
  const {enqueueSnackbar} = useSnackbar();
  const queryClient = useQueryClient();
  const [editShortcut, setEditShortcut] = useState<ArticleShortcut | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // API client
  const api = ArticleShortcutControllerApiFactory();
  
  // Fetch all shortcuts
  const {data: shortcuts = []} = useQuery<ArticleShortcut[]>(
    ["article-shortcuts"],
    async () => {
      const response = await api.getAllShortcutsUsingGET();
      return response.data;
    }
  );
  
  // Fetch importable default shortcuts
  const {data: importableShortcuts = []} = useQuery<ArticleShortcut[]>(
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
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
      },
      onError: (error: any) => {
        const errorMessage = error.message || "Failed to save shortcut";
        enqueueSnackbar(errorMessage, {
          variant: "error",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
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
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
      },
      onError: (error) => {
        enqueueSnackbar(`Failed to delete shortcut: ${error}`, {
          variant: "error",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
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
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
      },
      onError: (error) => {
        enqueueSnackbar(`Failed to import shortcuts: ${error}`, {
          variant: "error",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
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
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
        // Refresh to restore original order
        queryClient.invalidateQueries(["article-shortcuts"]);
      }
    }
  );
  
  // Mutation for toggling a shortcut's enabled status
  const toggleShortcutMutation = useMutation(
    async (shortcut: ArticleShortcut) => {
      const updatedShortcut = {...shortcut, enabled: !shortcut.enabled};
      await api.updateShortcutUsingPUT(shortcut.id!, updatedShortcut);
      return updatedShortcut;
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(["article-shortcuts"]);
        const statusText = data.enabled ? "enabled" : "disabled";
        enqueueSnackbar(`Shortcut "${data.name}" ${statusText} successfully`, {
          variant: "success",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
      },
      onError: (error) => {
        enqueueSnackbar(`Failed to update shortcut: ${error}`, {
          variant: "error",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
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
    setEditShortcut({...shortcut});
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
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
      return;
    }
    
    saveShortcutMutation.mutate(editShortcut);
  };
  
  const handleToggleShortcut = (shortcut: ArticleShortcut) => {
    toggleShortcutMutation.mutate(shortcut);
  };
  
  const handleImportDefaults = () => {
    importShortcutsMutation.mutate();
  };
  
  const handleOpenImportModal = () => {
    setIsImportModalOpen(true);
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
      <div className="flex justify-between items-center mb-2">
        <Typography variant={'h6'} className={''}>
          Article Operation Shortcuts
        </Typography>
        <div>
          <Button
            startIcon={<DownloadIcon />}
            variant="outlined"
            className="mr-2"
            onClick={handleOpenImportModal}
          >
            Import Presets
          </Button>
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={handleAddShortcut}
          >
            Add Shortcut
          </Button>
        </div>
      </div>
      <Divider />
      
      {/* Shortcut List */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="shortcuts">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="mt-2"
            >
              {shortcuts?.map((shortcut, index) => (
                <Draggable
                  key={shortcut.id || `new-${index}`}
                  draggableId={shortcut.id?.toString() || `new-${index}`}
                  index={index}
                >
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="border rounded p-3 mb-2 bg-white"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <div className="mr-2">
                            <Switch
                              size="small"
                              checked={shortcut.enabled}
                              onChange={() => handleToggleShortcut(shortcut)}
                              color="primary"
                            />
                          </div>
                          <div>
                            <div className="flex items-center">
                              <Typography variant="subtitle1" className="font-medium mr-2">
                                {shortcut.name}
                              </Typography>
                              {shortcut.enabled ? (
                                <Chip 
                                  size="small" 
                                  label="Enabled" 
                                  color="primary" 
                                  variant="outlined"
                                />
                              ) : (
                                <Chip 
                                  size="small" 
                                  label="Disabled" 
                                  color="default" 
                                  variant="outlined"
                                />
                              )}
                            </div>
                            <Typography variant="body2" color="textSecondary">
                              {shortcut.description}
                            </Typography>
                          </div>
                        </div>
                        <div>
                          <IconButton
                            size="small"
                            onClick={() => handleEditShortcut(shortcut)}
                            className="mr-1"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => shortcut.id && handleDeleteShortcut(shortcut.id)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      
      {shortcuts?.length === 0 && (
        <div className="text-center p-4 text-gray-500">
          No shortcuts found. Add one or import presets.
        </div>
      )}
      
      {/* Edit/Add Shortcut Dialog */}
      <Dialog open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>
          {editShortcut?.id ? "Edit Shortcut" : "Add New Shortcut"}
        </DialogTitle>
        <DialogContent>
          <div className="mt-2">
            <TextField
              fullWidth
              label="Name"
              value={editShortcut?.name || ""}
              onChange={(e) => setEditShortcut({...editShortcut!, name: e.target.value})}
              margin="normal"
              required
            />
          </div>
          <div className="mt-2">
            <TextField
              fullWidth
              label="Description"
              value={editShortcut?.description || ""}
              onChange={(e) => setEditShortcut({...editShortcut!, description: e.target.value})}
              margin="normal"
            />
          </div>
          <div className="mt-2">
            <TextField
              fullWidth
              label="Content (Prompt)"
              value={editShortcut?.content || ""}
              onChange={(e) => setEditShortcut({...editShortcut!, content: e.target.value})}
              margin="normal"
              multiline
              rows={10}
              required
            />
          </div>
          <FormControlLabel
            control={
              <Switch
                checked={editShortcut?.enabled || false}
                onChange={(e) => setEditShortcut({...editShortcut!, enabled: e.target.checked})}
                color="primary"
              />
            }
            label="Enabled"
            className="mt-2"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveShortcut} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Import Presets Dialog */}
      <Dialog open={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Import Preset Shortcuts</DialogTitle>
        <DialogContent>
          {importableShortcuts.length > 0 ? (
            <List>
              {importableShortcuts.map((shortcut) => (
                <ListItem key={shortcut.name}>
                  <ListItemIcon>
                    <CheckCircleIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={shortcut.name}
                    secondary={shortcut.description}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <div className="text-center p-4 text-gray-500">
              No new presets available to import.
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsImportModalOpen(false)}>Cancel</Button>
          <Button
            onClick={handleImportDefaults}
            variant="contained"
            color="primary"
            disabled={importableShortcuts.length === 0}
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ArticleShortcutSetting; 