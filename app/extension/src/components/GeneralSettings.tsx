import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  Link,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Snackbar,
  Typography,
} from "@mui/material";
import { ContentParserType, readSyncStorageSettings, STORAGE_CONTENT_PARSER } from "../storage";
import { DISPLAY_LANGUAGE_OPTIONS } from "../displayLanguage";
import { useI18n } from "../i18n";

export const GeneralSettings: React.FC = () => {
  const { language, setLanguage, t } = useI18n();
  const [contentParser, setContentParser] = useState<ContentParserType>("readability");
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
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        onClose={() => setShowSavedTip(false)}
      >
        <Alert severity="success" onClose={() => setShowSavedTip(false)}>
          {t("common.settingsSaved")}
        </Alert>
      </Snackbar>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            {t("general.displayLanguage.title")}
          </Typography>

          <FormControl size="small" fullWidth>
            <InputLabel id="display-language-label">
              {t("general.displayLanguage.label")}
            </InputLabel>
            <Select
              labelId="display-language-label"
              value={language}
              label={t("general.displayLanguage.label")}
              onChange={(e) => {
                setLanguage(e.target.value as typeof language);
                setShowSavedTip(true);
              }}
            >
              {DISPLAY_LANGUAGE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Box sx={{ display: "flex", flexDirection: "column" }}>
                    <Typography variant="body2" fontWeight={500}>
                      {option.value === "en"
                        ? t("general.displayLanguage.english")
                        : t("general.displayLanguage.simplifiedChinese")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.nativeLabel}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
            {t("general.contentParser.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("general.contentParser.description")}
          </Typography>

          <FormControl component="fieldset">
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
                      {t("general.contentParser.readability.title")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("general.contentParser.readability.description")}
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start", mb: 2 }}
              />
              <FormControlLabel
                value="defuddle"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      {t("general.contentParser.defuddle.title")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("general.contentParser.defuddle.description")}{" "}
                      <Link
                        href="https://github.com/kepano/defuddle"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t("common.learnMore")}
                      </Link>
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start" }}
              />
            </RadioGroup>
          </FormControl>
        </Box>
      </Box>
    </div>
  );
};