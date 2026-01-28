import React, { useEffect, useState } from 'react';
import {
  Alert,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Snackbar,
  Typography,
  Box,
  Link,
} from '@mui/material';
import {
  ContentParserType,
  readSyncStorageSettings,
  STORAGE_CONTENT_PARSER,
} from '../storage';

export const ParserSettings: React.FC = () => {
  const [contentParser, setContentParser] = useState<ContentParserType>('readability');
  const [showSavedTip, setShowSavedTip] = useState<boolean>(false);

  useEffect(() => {
    readSyncStorageSettings().then((settings) => {
      setContentParser(settings.contentParser);
    });
  }, []);

  const handleParserChange = (value: ContentParserType) => {
    setContentParser(value);
    chrome.storage.sync.set(
      {
        [STORAGE_CONTENT_PARSER]: value,
      },
      () => {
        setShowSavedTip(true);
      }
    );
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
        <h2 className="section-title">Default Content Parser</h2>
        <p className="section-description">
          Choose the parser engine for extracting article content.
        </p>
      </div>

      <FormControl component="fieldset" sx={{ mt: 2 }}>
        <RadioGroup
          value={contentParser}
          onChange={(e) => handleParserChange(e.target.value as ContentParserType)}
        >
          <FormControlLabel
            value="readability"
            control={<Radio />}
            label={
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  Mozilla Readability
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  The classic parser used by Firefox Reader View. Stable and well-tested.
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mb: 2 }}
          />
          <FormControlLabel
            value="defuddle"
            control={<Radio />}
            label={
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  Defuddle
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  A modern parser by Obsidian. More forgiving, extracts more metadata,
                  and provides consistent output for code blocks, footnotes, and math.{' '}
                  <Link
                    href="https://github.com/kepano/defuddle"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Learn more
                  </Link>
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start' }}
          />
        </RadioGroup>
      </FormControl>
    </div>
  );
};

