import React, { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsPage } from './components/SettingsPage';
import { CssBaseline, StyledEngineProvider, ThemeProvider, createTheme } from '@mui/material';
import { enUS, zhCN } from '@mui/material/locale';
import { ExtensionI18nProvider, useI18n } from './i18n';
import './options.css';

const baseThemeOptions = {
  palette: {
    primary: {
      main: '#3B82F6',
    },
    secondary: {
      main: '#60A5FA',
    },
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
};

const OptionsApp = () => {
  const { language } = useI18n();

  const theme = useMemo(
    () => createTheme(baseThemeOptions, language === 'zh-CN' ? zhCN : enUS),
    [language]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SettingsPage />
    </ThemeProvider>
  );
};

const root = createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <StyledEngineProvider injectFirst>
    <ExtensionI18nProvider>
      <OptionsApp />
    </ExtensionI18nProvider>
  </StyledEngineProvider>
);
