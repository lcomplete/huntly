import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  AIProviderConfig,
  ConnectionTestResult,
  ModelInfo,
  ProviderType,
  PROVIDER_REGISTRY,
} from '../ai/types';
import {
  deleteProviderConfig,
  getProviderConfig,
  saveProviderConfig,
} from '../ai/storage';
import { fetchOllamaModels, testProviderConnection } from '../ai/providers';

export interface AIProviderDialogProps {
  open: boolean;
  providerType: ProviderType;
  onClose: () => void;
}

export const AIProviderDialog: React.FC<AIProviderDialogProps> = ({
  open,
  providerType,
  onClose,
}) => {
  const meta = PROVIDER_REGISTRY[providerType];

  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [enabledModels, setEnabledModels] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>(
    meta.defaultModels
  );
  const [customModels, setCustomModels] = useState<string[]>([]);
  const [newModelName, setNewModelName] = useState('');
  const [showAddModel, setShowAddModel] = useState(false);
  const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null);
  const [editingModelName, setEditingModelName] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  // Get all preset model IDs for duplicate checking
  const presetModelIds = new Set(availableModels.map((m) => m.id));

  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open, providerType]);

  const loadConfig = async () => {
    const config = await getProviderConfig(providerType);
    const defaultPresetModels = meta.defaultModels;
    const presetIds = new Set(defaultPresetModels.map((m) => m.id));

    if (config) {
      setApiKey(config.apiKey);
      // Only set baseUrl if it was explicitly saved (not the default)
      setBaseUrl(config.baseUrl || '');
      // Separate custom models from preset models
      const custom = config.enabledModels.filter((id) => !presetIds.has(id));
      const preset = config.enabledModels.filter((id) => presetIds.has(id));
      setEnabledModels(preset);
      setCustomModels(custom);
    } else {
      setApiKey('');
      // Use empty string - show default as placeholder instead
      setBaseUrl('');
      // Select the first preset model by default
      setEnabledModels(defaultPresetModels.slice(0, 1).map((m) => m.id));
      setCustomModels([]);
    }
    setAvailableModels(defaultPresetModels);
    setNewModelName('');
    setTestResult(null);

    if (providerType === 'ollama') {
      refreshOllamaModels();
    }
  };

  const refreshOllamaModels = async () => {
    setLoadingModels(true);
    try {
      const models = await fetchOllamaModels(baseUrl || undefined);
      if (models.length > 0) {
        setAvailableModels(models.map((id) => ({ id, name: id })));
      }
    } finally {
      setLoadingModels(false);
    }
  };

  // Get all selected models (preset + custom)
  const getAllEnabledModels = () => [...enabledModels, ...customModels];

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const allModels = getAllEnabledModels();
      const config: AIProviderConfig = {
        type: providerType,
        apiKey,
        baseUrl: baseUrl || undefined,
        enabledModels:
          allModels.length > 0 ? allModels : [meta.defaultModels[0]?.id],
        enabled: true,
        updatedAt: Date.now(),
      };
      const result = await testProviderConnection(config);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allModels = getAllEnabledModels();
      const config: AIProviderConfig = {
        type: providerType,
        apiKey,
        baseUrl: baseUrl || undefined,
        enabledModels: allModels,
        enabled: true,
        updatedAt: Date.now(),
      };
      await saveProviderConfig(providerType, config);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteProviderConfig(providerType);
    onClose();
  };

  const toggleModel = (modelId: string) => {
    setEnabledModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  };

  const handleAddCustomModel = () => {
    const trimmed = newModelName.trim();
    if (!trimmed) return;
    // Check if it duplicates a preset model
    if (presetModelIds.has(trimmed)) {
      return; // Don't allow duplicate of preset
    }
    // Check if it already exists in custom models
    if (customModels.includes(trimmed)) {
      return;
    }
    setCustomModels((prev) => [...prev, trimmed]);
    setNewModelName('');
    setShowAddModel(false);
  };

  const getAddModelHelperText = (): string | undefined => {
    const trimmed = newModelName.trim();
    if (presetModelIds.has(trimmed)) {
      return 'This model is already in presets';
    }
    if (customModels.includes(trimmed)) {
      return 'This model already exists';
    }
    return undefined;
  };

  const handleRemoveCustomModel = (modelId: string) => {
    setCustomModels((prev) => prev.filter((id) => id !== modelId));
  };

  const handleStartEditCustomModel = (index: number, modelId: string) => {
    setEditingModelIndex(index);
    setEditingModelName(modelId);
  };

  const handleSaveEditCustomModel = () => {
    if (editingModelIndex === null) return;
    const trimmed = editingModelName.trim();
    if (!trimmed) return;
    // Check if it duplicates a preset model
    if (presetModelIds.has(trimmed)) return;
    // Check if it duplicates another custom model (excluding current)
    const otherCustomModels = customModels.filter((_, i) => i !== editingModelIndex);
    if (otherCustomModels.includes(trimmed)) return;

    setCustomModels((prev) => {
      const newModels = [...prev];
      newModels[editingModelIndex] = trimmed;
      return newModels;
    });
    setEditingModelIndex(null);
    setEditingModelName('');
  };

  const handleCancelEditCustomModel = () => {
    setEditingModelIndex(null);
    setEditingModelName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomModel();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEditCustomModel();
    } else if (e.key === 'Escape') {
      handleCancelEditCustomModel();
    }
  };

  const allSelectedCount = enabledModels.length + customModels.length;
  const canSave =
    (providerType === 'ollama' || apiKey.trim() !== '') && allSelectedCount > 0;

  const getApiUrlHelperText = (type: ProviderType): string => {
    if (type === 'ollama') {
      return 'Default: http://localhost:11434';
    }
    if (type === 'azure-openai' || type === 'azure-ai') {
      return 'Required: Your Azure endpoint URL';
    }
    return 'Leave empty to use the default endpoint';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {meta.displayName} Settings
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {meta.requiresApiKey && (
            <TextField
              label="API Key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              fullWidth
              size="small"
              placeholder={`Enter your ${meta.displayName} API key`}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowApiKey(!showApiKey)}
                      edge="end"
                      size="small"
                    >
                      {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}

          {meta.supportsCustomUrl && (
            <TextField
              label="API Proxy URL (Optional)"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              fullWidth
              size="small"
              placeholder={meta.defaultBaseUrl || 'Custom API endpoint'}
              helperText={getApiUrlHelperText(providerType)}
            />
          )}

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              onClick={handleTest}
              disabled={testing || (meta.requiresApiKey && !apiKey)}
              startIcon={
                testing ? <CircularProgress size={16} /> : undefined
              }
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
            {providerType === 'ollama' && (
              <Button
                variant="outlined"
                onClick={refreshOllamaModels}
                disabled={loadingModels}
                startIcon={
                  loadingModels ? (
                    <CircularProgress size={16} />
                  ) : (
                    <RefreshIcon />
                  )
                }
              >
                Refresh Models
              </Button>
            )}
          </Box>

          {testResult && (
            <Alert severity={testResult.success ? 'success' : 'error'}>
              {testResult.message}
            </Alert>
          )}

          <Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2">Models</Typography>
                <Typography variant="caption" color="text.secondary">
                  ({allSelectedCount} models available)
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => setShowAddModel(!showAddModel)}
                color={showAddModel ? 'primary' : 'default'}
                title="Add custom model"
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Add custom model input */}
            {showAddModel && (
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  placeholder="Enter model name"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  sx={{ flex: 1 }}
                  error={!!getAddModelHelperText()}
                  helperText={getAddModelHelperText()}
                  autoFocus
                />
                <Button
                  variant="outlined"
                  onClick={handleAddCustomModel}
                  disabled={
                    !newModelName.trim() ||
                    presetModelIds.has(newModelName.trim()) ||
                    customModels.includes(newModelName.trim())
                  }
                >
                  Add
                </Button>
              </Box>
            )}

            <List
              dense
              sx={{
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                maxHeight: 240,
                overflow: 'auto',
              }}
            >
              {/* Custom models first */}
              {customModels.map((modelId, index) => (
                <ListItem
                  key={`custom-${modelId}`}
                  secondaryAction={
                    <Switch
                      edge="end"
                      checked={true}
                      onChange={() => handleRemoveCustomModel(modelId)}
                    />
                  }
                >
                  {editingModelIndex === index ? (
                    <TextField
                      size="small"
                      value={editingModelName}
                      onChange={(e) => setEditingModelName(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={handleSaveEditCustomModel}
                      autoFocus
                      sx={{ flex: 1, mr: 1 }}
                    />
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ListItemText primary={modelId} />
                      <IconButton
                        size="small"
                        onClick={() => handleStartEditCustomModel(index, modelId)}
                        title="Edit model name"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveCustomModel(modelId)}
                        title="Delete model"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </ListItem>
              ))}
              {/* Preset models */}
              {availableModels.map((model) => (
                <ListItem
                  key={model.id}
                  secondaryAction={
                    <Switch
                      edge="end"
                      checked={enabledModels.includes(model.id)}
                      onChange={() => toggleModel(model.id)}
                    />
                  }
                >
                  <ListItemText primary={model.id} />
                </ListItem>
              ))}
            </List>
            {allSelectedCount === 0 && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                Please enable at least one model
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
        <Button color="error" onClick={handleDelete}>
          Remove
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};
