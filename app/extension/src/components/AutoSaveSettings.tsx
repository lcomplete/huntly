import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  FormControlLabel,
  Snackbar,
  Switch,
} from '@mui/material';
import { ContentParserType, readSyncStorageSettings, StorageSettings, DefaultStorageSettings } from '../storage';

export type AutoSaveSettingsProps = {
  onSettingsChange?: (settings: StorageSettings) => void;
};

export const AutoSaveSettings: React.FC<AutoSaveSettingsProps> = ({
  onSettingsChange,
}) => {
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);
  const [autoSaveTweet, setAutoSaveTweet] = useState<boolean>(false);
  const [showSavedTip, setShowSavedTip] = useState<boolean>(false);
  const [serverUrl, setServerUrl] = useState<string>('');
  const [serverUrlList, setServerUrlList] = useState<{ url: string }[]>([]);
  const [contentParser, setContentParser] = useState<ContentParserType>('readability');

  useEffect(() => {
    readSyncStorageSettings().then((settings) => {
      setAutoSaveEnabled(settings.autoSaveEnabled);
      setAutoSaveTweet(settings.autoSaveTweet);
      setServerUrl(settings.serverUrl);
      setServerUrlList(settings.serverUrlList);
      setContentParser(settings.contentParser);
    });
  }, []);

  const handleSave = () => {
    const storageSettings: StorageSettings = {
      ...DefaultStorageSettings,
      serverUrl,
      serverUrlList,
      autoSaveEnabled,
      autoSaveTweet,
      contentParser,
    };
    chrome.storage.sync.set(
      {
        autoSaveEnabled,
        autoSaveTweet,
      },
      () => {
        setShowSavedTip(true);
        if (onSettingsChange) {
          onSettingsChange(storageSettings);
        }
      }
    );
  };

  return (
    <div className="settings-section">
      <Snackbar
        open={showSavedTip}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={() => setShowSavedTip(false)}
      >
        <Alert severity="success" onClose={() => setShowSavedTip(false)}>
          Settings saved.
        </Alert>
      </Snackbar>

      <div className="section-header">
        <h2 className="section-title">Auto Save Article</h2>
        <p className="section-description">
          Automatically save articles when you browse web pages.
        </p>
      </div>

      <div className="setting-item">
        <FormControlLabel
          control={
            <Switch
              checked={autoSaveEnabled}
              onChange={(e) => setAutoSaveEnabled(e.target.checked)}
            />
          }
          label="Enable auto save articles"
        />
      </div>

      <div className="section-header mt-6">
        <h2 className="section-title">Auto Save Tweet</h2>
        <p className="section-description">
          Automatically save tweets when you browse Twitter/X.
        </p>
      </div>

      <div className="setting-item">
        <FormControlLabel
          control={
            <Switch
              checked={autoSaveTweet}
              onChange={(e) => setAutoSaveTweet(e.target.checked)}
            />
          }
          label="Enable auto save tweets"
        />
      </div>

      <Button
        color="primary"
        variant="contained"
        onClick={handleSave}
        sx={{ mt: 4 }}
      >
        Save
      </Button>
    </div>
  );
};
