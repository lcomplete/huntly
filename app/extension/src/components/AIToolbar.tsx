import React, { useState, useEffect } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListSubheader,
  Divider,
  CircularProgress,
  Typography,
  Box,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SettingsIcon from '@mui/icons-material/Settings';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
  Prompt,
  getPromptsSettings,
} from '../storage';
import { fetchEnabledShortcuts, getApiBaseUrl } from '../services';
import {
  getAIProvidersStorage,
  getAvailableProviderTypes,
  getEffectiveDefaultProviderType,
} from '../ai/storage';
import {
  ProviderType,
  PROVIDER_REGISTRY,
} from '../ai/types';

// Types
export interface ShortcutItem {
  id: string | number;
  name: string;
  content?: string;
  type: 'user' | 'system' | 'huntly';
}

export interface ModelItem {
  id: string;
  name: string;
  provider: ProviderType;
  providerName: string;
}

/** Data structure for externally provided shortcuts */
export interface ExternalShortcutsData {
  userPrompts: Prompt[];
  systemPrompts: Prompt[];
  huntlyShortcuts: any[];
  huntlyShortcutsEnabled: boolean;
}

/** Data structure for externally provided models */
export interface ExternalModelsData {
  models: ModelItem[];
  defaultModel: ModelItem | null;
}

export interface AIToolbarProps {
  onShortcutClick: (shortcut: ShortcutItem, selectedModel: ModelItem | null) => void;
  isProcessing?: boolean;
  showPreview?: boolean;
  onPreviewClick?: () => void;
  compact?: boolean;
  /** Container element for Menu portals (used in Shadow DOM) */
  menuContainer?: HTMLElement | (() => HTMLElement);
  /** Externally provided shortcuts data (for content script use) */
  externalShortcuts?: ExternalShortcutsData;
  /** Externally provided models data (for content script use) */
  externalModels?: ExternalModelsData;
  /** Initial selected model (used when auto-executing from popup) */
  initialSelectedModel?: ModelItem | null;
}

// Gradient definition for AI icon
export const AIGradientDef = () => (
  <svg width={0} height={0} style={{ position: 'absolute', visibility: 'hidden' }}>
    <linearGradient id="aiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#4facfe" />
      <stop offset="50%" stopColor="#a18cd1" />
      <stop offset="100%" stopColor="#fbc2eb" />
    </linearGradient>
  </svg>
);

export const AIToolbar: React.FC<AIToolbarProps> = ({
  onShortcutClick,
  isProcessing = false,
  compact = false,
  menuContainer,
  externalShortcuts,
  externalModels,
  initialSelectedModel,
}) => {
  // Determine if using external data
  const useExternalShortcuts = !!externalShortcuts;
  const useExternalModels = !!externalModels;

  // Shortcuts state
  const [userPrompts, setUserPrompts] = useState<Prompt[]>(
    externalShortcuts?.userPrompts || []
  );
  const [systemPrompts, setSystemPrompts] = useState<Prompt[]>(
    externalShortcuts?.systemPrompts || []
  );
  const [huntlyShortcuts, setHuntlyShortcuts] = useState<any[]>(
    externalShortcuts?.huntlyShortcuts || []
  );
  const [huntlyShortcutsEnabled, setHuntlyShortcutsEnabled] = useState(
    externalShortcuts?.huntlyShortcutsEnabled ?? true
  );
  const [loadingShortcuts, setLoadingShortcuts] = useState(!useExternalShortcuts);

  // Models state
  const [models, setModels] = useState<ModelItem[]>(
    externalModels?.models || []
  );
  const [selectedModel, setSelectedModel] = useState<ModelItem | null>(
    initialSelectedModel || externalModels?.defaultModel || null
  );
  const [loadingModels, setLoadingModels] = useState(!useExternalModels);

  // Sync selectedModel when initialSelectedModel is provided (for auto-execute from popup)
  useEffect(() => {
    if (initialSelectedModel) {
      setSelectedModel(initialSelectedModel);
    }
  }, [initialSelectedModel]);

  // Menu state
  const [shortcutAnchorEl, setShortcutAnchorEl] = useState<null | HTMLElement>(null);
  const [modelAnchorEl, setModelAnchorEl] = useState<null | HTMLElement>(null);
  const shortcutMenuOpen = Boolean(shortcutAnchorEl);
  const modelMenuOpen = Boolean(modelAnchorEl);

  // Load shortcuts (only if not using external data)
  useEffect(() => {
    if (useExternalShortcuts) return;

    async function loadShortcuts() {
      setLoadingShortcuts(true);
      try {
        // Load prompts from storage
        const promptsSettings = await getPromptsSettings();
        const enabledPrompts = promptsSettings.prompts.filter(p => p.enabled);
        setUserPrompts(enabledPrompts.filter(p => !p.isSystem));
        setSystemPrompts(enabledPrompts.filter(p => p.isSystem));
        setHuntlyShortcutsEnabled(promptsSettings.huntlyShortcutsEnabled);

        // Check if server is configured
        const baseUrl = await getApiBaseUrl();

        // Load huntly shortcuts if enabled and server configured
        if (baseUrl && promptsSettings.huntlyShortcutsEnabled) {
          try {
            // Try direct fetch first (works in popup/options),
            // fall back to message passing for content scripts (CORS issues)
            let shortcuts: any[] = [];
            try {
              shortcuts = await fetchEnabledShortcuts();
            } catch (fetchError) {
              // Direct fetch failed (likely CORS in content script), use message passing
              const response = await new Promise<{ success: boolean; shortcuts: any[] }>((resolve) => {
                chrome.runtime.sendMessage(
                  { type: 'get_huntly_shortcuts' },
                  (resp) => {
                    if (chrome.runtime.lastError) {
                      console.error('Message passing failed:', chrome.runtime.lastError);
                      resolve({ success: false, shortcuts: [] });
                    } else {
                      resolve(resp || { success: false, shortcuts: [] });
                    }
                  }
                );
              });
              shortcuts = response.shortcuts || [];
            }
            setHuntlyShortcuts(shortcuts);
          } catch (error) {
            console.error('Failed to load huntly shortcuts:', error);
            setHuntlyShortcuts([]);
          }
        }
      } catch (error) {
        console.error('Failed to load shortcuts:', error);
      } finally {
        setLoadingShortcuts(false);
      }
    }
    loadShortcuts();
  }, [useExternalShortcuts]);

  // Load models (only if not using external data)
  useEffect(() => {
    if (useExternalModels) return;

    async function loadModels() {
      setLoadingModels(true);
      try {
        const modelList: ModelItem[] = [];
        const storage = await getAIProvidersStorage();
        const availableProviders = await getAvailableProviderTypes();
        const baseUrl = await getApiBaseUrl();
        const promptsSettings = await getPromptsSettings();

        // Add Huntly Server models first (only if huntlyShortcutsEnabled)
        if (baseUrl && promptsSettings.huntlyShortcutsEnabled) {
          modelList.push({
            id: 'huntly-server:default',
            name: 'Huntly AI',
            provider: 'huntly-server',
            providerName: 'Huntly',
          });
        }

        // Add models from enabled providers
        for (const providerType of availableProviders) {
          if (providerType === 'huntly-server') continue;

          const config = storage.providers[providerType];
          if (config?.enabled && config.enabledModels.length > 0) {
            const providerMeta = PROVIDER_REGISTRY[providerType];
            for (const modelId of config.enabledModels) {
              const modelMeta = providerMeta.defaultModels.find(m => m.id === modelId);
              modelList.push({
                id: `${providerType}:${modelId}`,
                name: modelMeta?.name || modelId,
                provider: providerType,
                providerName: providerMeta.displayName,
              });
            }
          }
        }

        setModels(modelList);

        // Set default selected model
        if (modelList.length > 0) {
          const defaultProviderType = await getEffectiveDefaultProviderType();
          if (defaultProviderType) {
            const defaultModel = modelList.find(m => m.provider === defaultProviderType);
            setSelectedModel(defaultModel || modelList[0]);
          } else {
            setSelectedModel(modelList[0]);
          }
        }
      } catch (error) {
        console.error('Failed to load models:', error);
      } finally {
        setLoadingModels(false);
      }
    }
    loadModels();
  }, [useExternalModels]);

  const handleShortcutMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setShortcutAnchorEl(event.currentTarget);
  };

  const handleShortcutMenuClose = () => {
    setShortcutAnchorEl(null);
  };

  const handleModelMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setModelAnchorEl(event.currentTarget);
  };

  const handleModelMenuClose = () => {
    setModelAnchorEl(null);
  };

  const handleShortcutSelect = (shortcut: ShortcutItem) => {
    handleShortcutMenuClose();
    onShortcutClick(shortcut, selectedModel);
  };

  const handleModelSelect = (model: ModelItem) => {
    setSelectedModel(model);
    handleModelMenuClose();
  };

  const openSettings = (tab?: string) => {
    const optionsUrl = chrome.runtime.getURL('options.html');
    const url = tab ? `${optionsUrl}#${tab}` : optionsUrl;
    chrome.tabs.create({ url });
    handleShortcutMenuClose();
    handleModelMenuClose();
  };

  // Check if selected model is Huntly AI
  const isHuntlyAISelected = selectedModel?.provider === 'huntly-server';

  // Determine which shortcuts to show based on selected model
  const showHuntlyShortcuts = isHuntlyAISelected && huntlyShortcutsEnabled && huntlyShortcuts.length > 0;
  const showUserSystemPrompts = !isHuntlyAISelected;

  const hasShortcuts = showHuntlyShortcuts ||
    (showUserSystemPrompts && (userPrompts.length > 0 || systemPrompts.length > 0));
  const hasModels = models.length > 0;

  // Group models by provider - only show Huntly AI when huntlyShortcutsEnabled is true
  const huntlyModels = huntlyShortcutsEnabled
    ? models.filter(m => m.provider === 'huntly-server')
    : [];
  const otherModels = models.filter(m => m.provider !== 'huntly-server');

  // Group other models by provider
  const modelsByProvider = otherModels.reduce((acc, model) => {
    if (!acc[model.providerName]) {
      acc[model.providerName] = [];
    }
    acc[model.providerName].push(model);
    return acc;
  }, {} as Record<string, ModelItem[]>);

  const buttonSize = compact ? 'small' : 'medium';
  // Ensure portal-based menus render above the shadow DOM overlay.
  const menuZIndex = 2147483647;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <AIGradientDef />

      {/* Model Selector */}
      <Button
        size={buttonSize}
        variant="outlined"
        onClick={handleModelMenuOpen}
        endIcon={<KeyboardArrowDownIcon />}
        disabled={loadingModels}
        sx={{
          textTransform: 'none',
          minWidth: compact ? 100 : 120,
          justifyContent: 'space-between',
        }}
      >
        {loadingModels ? (
          <CircularProgress size={14} />
        ) : selectedModel ? (
          <Typography variant="body2" noWrap sx={{ maxWidth: compact ? 80 : 100 }}>
            {selectedModel.name}
          </Typography>
        ) : (
          'Select Model'
        )}
      </Button>

      <Menu
        anchorEl={modelAnchorEl}
        open={modelMenuOpen}
        onClose={handleModelMenuClose}
        container={menuContainer}
        sx={{ zIndex: menuZIndex }}
        PaperProps={{ sx: { maxHeight: 400, minWidth: 180, zIndex: menuZIndex } }}
      >
        {!hasModels ? (
          <MenuItem onClick={() => openSettings('ai-providers')}>
            <SettingsIcon fontSize="small" sx={{ mr: 1 }} />
            Configure AI Providers
          </MenuItem>
        ) : (
          <>
            {/* Huntly models */}
            {huntlyModels.map(model => (
              <MenuItem
                key={model.id}
                onClick={() => handleModelSelect(model)}
                selected={selectedModel?.id === model.id}
              >
                {model.name}
              </MenuItem>
            ))}
            {/* Other providers */}
            {Object.entries(modelsByProvider).map(([providerName, providerModels], index) => (
              <React.Fragment key={providerName}>
                {(index > 0 || huntlyModels.length > 0) && <Divider />}
                <ListSubheader sx={{ lineHeight: '32px', bgcolor: 'background.paper' }}>
                  {providerName}
                </ListSubheader>
                {providerModels.map(model => (
                  <MenuItem
                    key={model.id}
                    onClick={() => handleModelSelect(model)}
                    selected={selectedModel?.id === model.id}
                  >
                    {model.name}
                  </MenuItem>
                ))}
              </React.Fragment>
            ))}
          </>
        )}
      </Menu>

      {/* AI Shortcuts Button */}
      <Button
        size={buttonSize}
        variant="text"
        color="primary"
        onClick={handleShortcutMenuOpen}
        startIcon={<AutoAwesomeIcon sx={{ fill: 'url(#aiGradient)' }} />}
        endIcon={isProcessing ? <CircularProgress size={14} /> : <KeyboardArrowDownIcon />}
        disabled={isProcessing}
        sx={{ textTransform: 'none' }}
      >
        AI Shortcuts
      </Button>

      <Menu
        anchorEl={shortcutAnchorEl}
        open={shortcutMenuOpen}
        onClose={handleShortcutMenuClose}
        container={menuContainer}
        sx={{ zIndex: menuZIndex }}
        PaperProps={{ sx: { maxHeight: 400, minWidth: 200, zIndex: menuZIndex } }}
      >
        {loadingShortcuts ? (
          <MenuItem disabled>
            <CircularProgress size={16} sx={{ mr: 1 }} />
            Loading...
          </MenuItem>
        ) : !hasShortcuts ? (
          <MenuItem onClick={() => openSettings('prompts')}>
            <SettingsIcon fontSize="small" sx={{ mr: 1 }} />
            {isHuntlyAISelected ? 'Configure Huntly Shortcuts' : 'Configure Prompts'}
          </MenuItem>
        ) : (
          <>
            {/* Huntly AI selected - show only Huntly Shortcuts */}
            {showHuntlyShortcuts && (
              <>
                <ListSubheader sx={{ lineHeight: '32px', bgcolor: 'background.paper' }}>
                  Huntly Shortcuts
                </ListSubheader>
                {huntlyShortcuts.map(shortcut => (
                  <MenuItem
                    key={`huntly-${shortcut.id}`}
                    onClick={() => handleShortcutSelect({
                      id: shortcut.id,
                      name: shortcut.name,
                      content: shortcut.prompt,
                      type: 'huntly',
                    })}
                  >
                    {shortcut.name}
                  </MenuItem>
                ))}
              </>
            )}
            {/* Other models selected - show User & System Prompts */}
            {showUserSystemPrompts && (
              <>
                {/* User Prompts */}
                {userPrompts.length > 0 && (
                  <ListSubheader sx={{ lineHeight: '32px', bgcolor: 'background.paper' }}>
                    Prompts
                  </ListSubheader>
                )}
                {userPrompts.map(prompt => (
                  <MenuItem
                    key={`user-${prompt.id}`}
                    onClick={() => handleShortcutSelect({
                      id: prompt.id,
                      name: prompt.name,
                      content: prompt.content,
                      type: 'user',
                    })}
                  >
                    {prompt.name}
                  </MenuItem>
                ))}
                {/* System Prompts */}
                {systemPrompts.length > 0 && userPrompts.length > 0 && <Divider />}
                {systemPrompts.length > 0 && (
                  <ListSubheader sx={{ lineHeight: '32px', bgcolor: 'background.paper' }}>
                    System Prompts
                  </ListSubheader>
                )}
                {systemPrompts.map(prompt => (
                  <MenuItem
                    key={`system-${prompt.id}`}
                    onClick={() => handleShortcutSelect({
                      id: prompt.id,
                      name: prompt.name,
                      content: prompt.content,
                      type: 'system',
                    })}
                  >
                    {prompt.name}
                  </MenuItem>
                ))}
              </>
            )}
          </>
        )}
      </Menu>
    </Box>
  );
};

export default AIToolbar;
