import React, { useState } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ArticleIcon from '@mui/icons-material/Article';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import { ServerSettings } from './ServerSettings';
import { AIProvidersSettings } from './AIProvidersSettings';
import { ParserSettings } from './ParserSettings';
import { PromptsSettings } from './PromptsSettings';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

export const SettingsPage: React.FC = () => {
  // Read initial tab from URL hash (e.g., options.html#ai-providers)
  const getInitialTab = () => {
    const hash = window.location.hash.slice(1); // Remove '#'
    const validTabs = ['server', 'ai-providers', 'prompts', 'parser'];
    return validTabs.includes(hash) ? hash : 'server';
  };

  const [activeMenu, setActiveMenu] = useState(getInitialTab);

  const menuItems: MenuItem[] = [
    {
      id: 'server',
      label: 'Server',
      icon: <SettingsIcon />,
      component: <ServerSettings />,
    },
    {
      id: 'ai-providers',
      label: 'AI Providers',
      icon: <SmartToyIcon />,
      component: <AIProvidersSettings />,
    },
    {
      id: 'prompts',
      label: 'Prompts',
      icon: <TextSnippetIcon />,
      component: <PromptsSettings />,
    },
    {
      id: 'parser',
      label: 'Content Parser',
      icon: <ArticleIcon />,
      component: <ParserSettings />,
    },
  ];

  const activeItem = menuItems.find((item) => item.id === activeMenu);

  return (
    <Box className="settings-layout">
      <Box className="settings-shell">
        <Box className="settings-sidebar">
          <Box className="sidebar-header">
            <img src="/favicon-32x32.png" alt="Huntly" className="sidebar-logo" style={{ width: 24, height: 24 }} />
            <Typography variant="h6" className="sidebar-title">
              Huntly
            </Typography>
          </Box>

          <List component="nav" className="sidebar-nav">
            {menuItems.map((item) => (
              <ListItemButton
                key={item.id}
                selected={activeMenu === item.id}
                onClick={() => setActiveMenu(item.id)}
                className="sidebar-nav-item"
              >
                <ListItemIcon className="sidebar-nav-icon">
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>

          <Box className="sidebar-footer">
            <Typography variant="caption" color="text.secondary">
              Huntly Extension v{chrome.runtime.getManifest().version}
            </Typography>
          </Box>
        </Box>

        <Box className="settings-main">
          <Box className="settings-content">
            {activeItem?.component}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
