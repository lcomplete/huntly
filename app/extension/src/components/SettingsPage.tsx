import React, { useEffect, useState } from 'react';
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
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import FavoriteIcon from '@mui/icons-material/Favorite';
import DnsIcon from '@mui/icons-material/Dns';
import { GeneralSettings } from './GeneralSettings';
import { ServerSettings } from './ServerSettings';
import { AIProvidersSettings } from './AIProvidersSettings';
import { PromptsSettings } from './PromptsSettings';
import { SponsorSettings } from './SponsorSettings';
import { useI18n } from '../i18n';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

export const SettingsPage: React.FC = () => {
  const { t } = useI18n();
  const validTabs = ['general', 'server', 'ai-providers', 'prompts', 'sponsor'];

  const getTabFromHash = () => {
    const hash = window.location.hash.slice(1); // Remove '#'
    if (hash === 'parser') {
      return 'general';
    }

    return validTabs.includes(hash) ? hash : 'general';
  };

  const [activeMenu, setActiveMenu] = useState(getTabFromHash);

  useEffect(() => {
    const syncMenuFromHash = () => {
      setActiveMenu(getTabFromHash());
    };

    window.addEventListener('hashchange', syncMenuFromHash);
    syncMenuFromHash();

    return () => {
      window.removeEventListener('hashchange', syncMenuFromHash);
    };
  }, []);

  useEffect(() => {
    const expectedHash = `#${activeMenu}`;
    if (window.location.hash !== expectedHash) {
      window.history.replaceState(null, '', expectedHash);
    }
  }, [activeMenu]);

  const menuItems: MenuItem[] = [
    {
      id: 'general',
      label: t('menu.general'),
      icon: <SettingsIcon />,
      component: <GeneralSettings />,
    },
    {
      id: 'server',
      label: t('menu.server'),
      icon: <DnsIcon />,
      component: <ServerSettings />,
    },
    {
      id: 'ai-providers',
      label: t('menu.aiProviders'),
      icon: <SmartToyIcon />,
      component: <AIProvidersSettings />,
    },
    {
      id: 'prompts',
      label: t('menu.prompts'),
      icon: <TextSnippetIcon />,
      component: <PromptsSettings />,
    },
    {
      id: 'sponsor',
      label: t('menu.sponsor'),
      icon: <FavoriteIcon />,
      component: <SponsorSettings />,
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
                component="a"
                href={`#${item.id}`}
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
              {t('sidebar.extensionVersion', {
                version: chrome.runtime.getManifest().version,
              })}
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
