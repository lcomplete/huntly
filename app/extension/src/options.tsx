import React from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsPage } from './components/SettingsPage';
import { CssBaseline, StyledEngineProvider, ThemeProvider, createTheme } from '@mui/material';
import './options.css';

const theme = createTheme({
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
});

const root = createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <StyledEngineProvider injectFirst>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SettingsPage />
    </ThemeProvider>
  </StyledEngineProvider>
);
