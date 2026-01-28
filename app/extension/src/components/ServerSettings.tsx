import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LockIcon from '@mui/icons-material/Lock';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LoginIcon from '@mui/icons-material/Login';
import {
  readSyncStorageSettings,
  ServerUrlItem,
  getPromptsSettings,
  savePromptsSettings,
} from '../storage';
import { getLoginUserInfo, fetchEnabledShortcuts } from '../services';

interface ServerShortcut {
  id: number;
  name: string;
  prompt: string;
  enabled: boolean;
}

interface UserInfo {
  username: string;
}

export type ServerSettingsProps = {
  onSettingsChange?: () => void;
};

export const ServerSettings: React.FC<ServerSettingsProps> = ({
  onSettingsChange,
}) => {
  const [serverUrlList, setServerUrlList] = useState<ServerUrlItem[]>([
    { url: '' },
  ]);
  const [enabledServerIndex, setEnabledServerIndex] = useState<number | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);
  const [autoSaveTweet, setAutoSaveTweet] = useState<boolean>(false);
  const [showSavedTip, setShowSavedTip] = useState<boolean>(false);
  const [urlErrors, setUrlErrors] = useState<Record<number, string>>({});

  // Login state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [checkingLogin, setCheckingLogin] = useState<boolean>(false);

  // Server shortcuts state
  const [huntlyShortcutsEnabled, setHuntlyShortcutsEnabled] = useState<boolean>(true);
  const [serverShortcuts, setServerShortcuts] = useState<ServerShortcut[]>([]);
  const [loadingShortcuts, setLoadingShortcuts] = useState<boolean>(false);
  const [serverShortcutsExpanded, setServerShortcutsExpanded] = useState<boolean>(false);

  // Check if a server is enabled (has a valid URL and is selected)
  const isServerEnabled = enabledServerIndex !== null &&
    serverUrlList[enabledServerIndex]?.url?.trim() !== '';

  const getServerUrl = useCallback(() => {
    if (enabledServerIndex !== null && serverUrlList[enabledServerIndex]?.url) {
      let url = serverUrlList[enabledServerIndex].url;
      if (!url.endsWith('/')) {
        url = url + '/';
      }
      return url;
    }
    return '';
  }, [enabledServerIndex, serverUrlList]);

  const checkLoginStatus = useCallback(async () => {
    if (!isServerEnabled) {
      setIsLoggedIn(false);
      setUserInfo(null);
      return;
    }

    setCheckingLogin(true);
    try {
      const response = await getLoginUserInfo();
      if (response) {
        const user = JSON.parse(response);
        // Check username to be consistent with popup.tsx login detection
        if (user && user.username) {
          setIsLoggedIn(true);
          setUserInfo(user);
        } else {
          setIsLoggedIn(false);
          setUserInfo(null);
        }
      } else {
        setIsLoggedIn(false);
        setUserInfo(null);
      }
    } catch (error) {
      console.error('Failed to check login status:', error);
      setIsLoggedIn(false);
      setUserInfo(null);
    } finally {
      setCheckingLogin(false);
    }
  }, [isServerEnabled]);

  const loadServerShortcuts = useCallback(async () => {
    if (!isServerEnabled || !isLoggedIn) {
      setServerShortcuts([]);
      return;
    }

    setLoadingShortcuts(true);
    try {
      const shortcuts = await fetchEnabledShortcuts();
      setServerShortcuts(shortcuts || []);
    } catch (error) {
      console.error('Failed to load server shortcuts:', error);
      setServerShortcuts([]);
    } finally {
      setLoadingShortcuts(false);
    }
  }, [isServerEnabled, isLoggedIn]);

  useEffect(() => {
    readSyncStorageSettings().then((settings) => {
      setAutoSaveEnabled(settings.autoSaveEnabled);
      setAutoSaveTweet(settings.autoSaveTweet);
      setHuntlyShortcutsEnabled(settings.huntlyShortcutsEnabled);
      if (settings.serverUrlList.length > 0) {
        setServerUrlList(settings.serverUrlList);
        // Find the enabled server index, or null if none is enabled
        let foundIndex: number | null = null;
        settings.serverUrlList.forEach((item, index) => {
          if (item.url === settings.serverUrl && settings.serverUrl) {
            foundIndex = index;
          }
        });
        setEnabledServerIndex(foundIndex);
      }
    });
  }, []);

  // Check login status when server is enabled
  useEffect(() => {
    checkLoginStatus();
  }, [checkLoginStatus]);

  // Load shortcuts when logged in
  useEffect(() => {
    if (isLoggedIn) {
      loadServerShortcuts();
    }
  }, [isLoggedIn, loadServerShortcuts]);

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    const urlPattern = /^(?:([a-z0-9+.-]+):\/\/)(?:\S+(?::\S*)?@)?(?:(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*\.?)(?::\d{2,5})?(?:[/?#]\S*)?$/;
    return urlPattern.test(url);
  };

  const saveServerSettings = useCallback((urlList: ServerUrlItem[], enabledIndex: number | null) => {
    const serverUrl = enabledIndex !== null ? (urlList[enabledIndex]?.url || '') : '';
    // Allow saving when no server is enabled (serverUrl is empty) or when a valid URL is selected
    if (serverUrl === '' || validateUrl(serverUrl)) {
      chrome.storage.sync.set({
        serverUrl,
        serverUrlList: urlList,
      }, () => {
        setShowSavedTip(true);
        onSettingsChange?.();
        // Re-check login status after server URL is saved to storage
        checkLoginStatus();
      });
    }
  }, [onSettingsChange, checkLoginStatus]);

  const handleUrlChange = (index: number, value: string) => {
    const newList = [...serverUrlList];
    newList[index] = { url: value };
    setServerUrlList(newList);

    // Validate and clear error if valid
    if (value && !validateUrl(value)) {
      setUrlErrors({ ...urlErrors, [index]: 'Enter correct url!' });
    } else {
      const newErrors = { ...urlErrors };
      delete newErrors[index];
      setUrlErrors(newErrors);
    }
  };

  const handleUrlBlur = (index: number) => {
    const url = serverUrlList[index]?.url;
    if (url && validateUrl(url)) {
      saveServerSettings(serverUrlList, enabledServerIndex);
    }
  };

  const handleEnabledChange = (index: number) => {
    // Toggle: if already enabled, disable it; otherwise enable it
    const newIndex = enabledServerIndex === index ? null : index;
    setEnabledServerIndex(newIndex);
    saveServerSettings(serverUrlList, newIndex);
  };

  const handleAddUrl = () => {
    setServerUrlList([...serverUrlList, { url: '' }]);
  };

  const handleRemoveUrl = (index: number) => {
    const newList = serverUrlList.filter((_, i) => i !== index);
    setServerUrlList(newList);
    let newEnabledIndex: number | null = enabledServerIndex;
    if (enabledServerIndex === index) {
      // Removed the enabled server, disable all
      newEnabledIndex = null;
    } else if (enabledServerIndex !== null && enabledServerIndex > index) {
      // Adjust index if removed item was before enabled one
      newEnabledIndex = enabledServerIndex - 1;
    }
    setEnabledServerIndex(newEnabledIndex);
    saveServerSettings(newList, newEnabledIndex);
  };

  const handleLogin = () => {
    const serverUrl = getServerUrl();
    if (serverUrl) {
      chrome.tabs.create({ url: serverUrl });
    }
  };

  const handleRefresh = async () => {
    await checkLoginStatus();
    if (isLoggedIn) {
      await loadServerShortcuts();
    }
  };

  const handleHuntlyShortcutsToggle = async (enabled: boolean) => {
    setHuntlyShortcutsEnabled(enabled);
    const settings = await getPromptsSettings();
    await savePromptsSettings({
      ...settings,
      huntlyShortcutsEnabled: enabled,
    });
    setShowSavedTip(true);
  };

  const handleOpenHuntlySettings = () => {
    const serverUrl = getServerUrl();
    if (serverUrl) {
      chrome.tabs.create({ url: `${serverUrl}settings/huntly-ai` });
    }
  };

  return (
    <div className="settings-section">
      <Snackbar
        open={showSavedTip}
        autoHideDuration={2000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={() => setShowSavedTip(false)}
      >
        <Alert severity="success" onClose={() => setShowSavedTip(false)}>
          Settings saved.
        </Alert>
      </Snackbar>

      <div className="section-header">
        <h2 className="section-title">Server Configuration</h2>
        <p className="section-description">
          Configure your Huntly server URL.{' '}
          <a
            href="https://github.com/lcomplete/huntly"
            target="_blank"
            rel="noopener noreferrer"
          >
            How to run the server &gt;
          </a>
        </p>
      </div>

      <div>
        {serverUrlList.map((item, index) => (
          <div key={`server-url-${index}`} className="flex items-center gap-2">
            <TextField
              margin="normal"
              size="small"
              variant="outlined"
              label="Server URL"
              fullWidth
              value={item.url}
              required
              error={Boolean(urlErrors[index])}
              helperText={urlErrors[index] || ''}
              onChange={(e) => handleUrlChange(index, e.target.value)}
              onBlur={() => handleUrlBlur(index)}
            />
            <div className="mt-2">
              <Switch
                checked={index === enabledServerIndex}
                onChange={() => handleEnabledChange(index)}
              />
            </div>
            <div className="mt-2">
              {index === 0 ? (
                <IconButton
                  onClick={handleAddUrl}
                  size="small"
                  color="primary"
                >
                  <AddIcon />
                </IconButton>
              ) : (
                <IconButton
                  onClick={() => handleRemoveUrl(index)}
                  size="small"
                  color="warning"
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Login Status - Only show when server is enabled */}
      {isServerEnabled && (
        <Box sx={{ mt: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {checkingLogin ? (
              <Typography variant="body2" color="text.secondary">
                Checking login status...
              </Typography>
            ) : isLoggedIn && userInfo ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary">
                  Logged in as <strong>{userInfo.username}</strong>
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Not logged in
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LoginIcon />}
                  onClick={handleLogin}
                >
                  Login
                </Button>
              </Box>
            )}
            <IconButton
              size="small"
              onClick={handleRefresh}
              disabled={checkingLogin}
              title="Refresh"
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Auto Save Settings - Only show when server is enabled */}
      {isServerEnabled && (
        <Paper variant="outlined" sx={{ mt: 3, p: 3 }}>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
            Auto Save
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Automatically save content to your Huntly server as you browse.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{
              p: 2,
              borderRadius: 1.5,
              bgcolor: autoSaveEnabled ? 'rgba(25, 118, 210, 0.04)' : 'transparent',
              border: '1px solid',
              borderColor: autoSaveEnabled ? 'rgba(25, 118, 210, 0.12)' : 'divider',
              transition: 'all 0.2s ease',
            }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoSaveEnabled}
                    onChange={(e) => {
                      setAutoSaveEnabled(e.target.checked);
                      chrome.storage.sync.set({ autoSaveEnabled: e.target.checked }, () => {
                        setShowSavedTip(true);
                      });
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>Auto save articles</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Save articles after staying on a page for a while
                    </Typography>
                  </Box>
                }
                sx={{ ml: 0, alignItems: 'flex-start', '& .MuiSwitch-root': { mt: 0.5 } }}
              />
            </Box>

            <Box sx={{
              p: 2,
              borderRadius: 1.5,
              bgcolor: autoSaveTweet ? 'rgba(25, 118, 210, 0.04)' : 'transparent',
              border: '1px solid',
              borderColor: autoSaveTweet ? 'rgba(25, 118, 210, 0.12)' : 'divider',
              transition: 'all 0.2s ease',
            }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoSaveTweet}
                    onChange={(e) => {
                      setAutoSaveTweet(e.target.checked);
                      chrome.storage.sync.set({ autoSaveTweet: e.target.checked }, () => {
                        setShowSavedTip(true);
                      });
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>Auto save tweets</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Save tweets from your timeline as you scroll on X
                    </Typography>
                  </Box>
                }
                sx={{ ml: 0, alignItems: 'flex-start', '& .MuiSwitch-root': { mt: 0.5 } }}
              />
              {isServerEnabled && (
                <Box sx={{ mt: 1, ml: '58px' }}>
                  <Typography
                    component="a"
                    variant="body2"
                    href={`${getServerUrl()}settings/x`}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      color: 'primary.main',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontSize: '0.8125rem',
                      '&:hover': {
                        textDecoration: 'underline',
                      }
                    }}
                  >
                    More Settings
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Paper>
      )}

      {/* Huntly Server AI Shortcuts - Only show when server is enabled */}
      {isServerEnabled && (
        <Paper variant="outlined" sx={{ mt: 3, p: 3 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 500 }}>
                Huntly Server AI Shortcuts
              </Typography>
              <Chip
                icon={<LockIcon sx={{ fontSize: 14 }} />}
                label="Read-only"
                size="small"
                variant="outlined"
                color="default"
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={huntlyShortcutsEnabled}
                    onChange={(e) => handleHuntlyShortcutsToggle(e.target.checked)}
                    size="small"
                    disabled={!isLoggedIn}
                  />
                }
                label="Enable"
                sx={{ mr: 1 }}
              />
              <IconButton
                size="small"
                onClick={handleRefresh}
                disabled={checkingLogin || loadingShortcuts}
                title="Refresh"
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {!isLoggedIn ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="body2">
                Please login to your Huntly server to use AI shortcuts. After logging in,
                configure AI provider and shortcuts in{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleOpenHuntlySettings();
                  }}
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  Huntly Server Settings
                </a>
                .
              </Typography>
            </Alert>
          ) : (
            <Collapse in={huntlyShortcutsEnabled}>
              {loadingShortcuts ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    color: 'text.secondary',
                  }}
                >
                  <Typography>Loading shortcuts...</Typography>
                </Paper>
              ) : serverShortcuts.length === 0 ? (
                <Alert severity="info">
                  <Typography variant="body2">
                    No AI shortcuts configured on server. Configure shortcuts in{' '}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleOpenHuntlySettings();
                      }}
                      style={{ color: 'inherit', textDecoration: 'underline' }}
                    >
                      Huntly Server Settings
                    </a>
                    .
                  </Typography>
                </Alert>
              ) : (
                <>
                  <Paper variant="outlined">
                    <List disablePadding>
                      {(serverShortcutsExpanded ? serverShortcuts : serverShortcuts.slice(0, 3)).map((shortcut, index) => (
                        <React.Fragment key={shortcut.id}>
                          {index > 0 && <Divider />}
                          <ListItem sx={{ py: 1.5, bgcolor: '#fafafa' }}>
                            <ListItemText
                              primary={shortcut.name}
                              secondary={
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: '450px',
                                  }}
                                >
                                  {shortcut.prompt}
                                </Typography>
                              }
                            />
                          </ListItem>
                        </React.Fragment>
                      ))}
                    </List>
                  </Paper>
                  {serverShortcuts.length > 3 && (
                    <Button
                      size="small"
                      onClick={() => setServerShortcutsExpanded(!serverShortcutsExpanded)}
                      startIcon={serverShortcutsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      sx={{ mt: 1 }}
                    >
                      {serverShortcutsExpanded ? 'Show less' : `Show all (${serverShortcuts.length})`}
                    </Button>
                  )}
                  <Box sx={{ mt: 2 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<OpenInNewIcon />}
                      onClick={handleOpenHuntlySettings}
                    >
                      Edit in Huntly Server
                    </Button>
                  </Box>
                </>
              )}
            </Collapse>
          )}

          {isLoggedIn && !huntlyShortcutsEnabled && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Huntly server shortcuts are disabled. Enable them to use server-side AI shortcuts.
            </Alert>
          )}
        </Paper>
      )}
    </div>
  );
};
