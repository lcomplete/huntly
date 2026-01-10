import React, { useCallback, useEffect, useState } from 'react';
import "./PrimaryNavigation.css";
import { Link, useLocation } from 'react-router-dom';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HomeIcon from '@mui/icons-material/Home';
import LocalLibraryOutlinedIcon from '@mui/icons-material/LocalLibraryOutlined';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import GitHubIcon from '@mui/icons-material/GitHub';
import SearchIcon from '@mui/icons-material/Search';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SvgIcon from '@mui/material/SvgIcon';
import { useNavigation, PrimaryNavItem } from '../../contexts/NavigationContext';
import { useQuery } from '@tanstack/react-query';
import { ConnectorControllerApiFactory } from '../../api';
import { ConnectorType } from '../../interfaces/connectorType';
import SettingModal from '../SettingModal';

// X (Twitter) Icon Component
const XIcon: React.FC<{ className?: string }> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </SvgIcon>
);

interface NavItemConfig {
  id: PrimaryNavItem;
  icon: React.ReactElement;
  activeIcon?: React.ReactElement;
  label: string;
  path: string;
  condition?: boolean;
}

const PrimaryNavigation: React.FC = () => {
  const location = useLocation();
  const { activeNav, setActiveNav } = useNavigation();
  const [settingModalOpen, setSettingModalOpen] = useState(false);

  const openSettingModal = useCallback(() => {
    setSettingModalOpen(true);
  }, []);

  const closeSettingModal = useCallback(() => {
    setSettingModalOpen(false);
  }, []);

  const {
    data: view,
  } = useQuery(['folder-connector-view'], async () => (await
    ConnectorControllerApiFactory().getFolderConnectorViewUsingGET()).data, {
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  // Find first GitHub connector
  let firstGithubConnector = null;
  if (view?.folderConnectors) {
    for (const folder of view.folderConnectors) {
      const githubItem = folder.connectorItems?.find(item => item.type === ConnectorType.GITHUB);
      if (githubItem) {
        firstGithubConnector = githubItem;
        break;
      }
    }
  }

  const navItems: NavItemConfig[] = [
    {
      id: 'home',
      icon: <HomeOutlinedIcon />,
      activeIcon: <HomeIcon />,
      label: 'Home',
      path: '/',
    },
    {
      id: 'saved',
      icon: <LocalLibraryOutlinedIcon />,
      activeIcon: <LocalLibraryIcon />,
      label: 'Library',
      path: '/list',
    },
    {
      id: 'feeds',
      icon: <RssFeedIcon />,
      label: 'Feeds',
      path: '/feeds',
    },
    {
      id: 'x',
      icon: <XIcon />,
      label: 'X',
      path: '/twitter',
    },
    {
      id: 'github',
      icon: <GitHubIcon />,
      label: 'Github',
      path: firstGithubConnector ? `/connector/${firstGithubConnector.id}` : '/github',
      condition: !!firstGithubConnector,
    },
  ];

  // Update active nav based on current path
  useEffect(() => {
    const path = location.pathname;
    if (path === '/search') {
      setActiveNav(null);
    } else if (path.startsWith('/page/')) {
      // Page detail page - no nav item should be active
      setActiveNav(null);
    } else if (path === '/' || path === '/recently-read') {
      setActiveNav('home');
    } else if (['/list', '/starred', '/later', '/archive', '/highlights'].includes(path)) {
      setActiveNav('saved');
    } else if (path === '/feeds') {
      // All feeds page
      setActiveNav('feeds');
    } else if (path.startsWith('/folder/') || path.startsWith('/connector/')) {
      // Check if it's RSS connector or RSS folder
      const isRssFeed = view?.folderFeedConnectors?.some(folder =>
        folder.connectorItems?.some(item => path.includes(`/connector/${item.id}`)) ||
        (folder.id && path === `/folder/${folder.id}`)
      );
      if (isRssFeed) {
        setActiveNav('feeds');
      } else {
        // Could be GitHub connector
        const isGithub = view?.folderConnectors?.some(folder =>
          folder.connectorItems?.some(item => item.type === ConnectorType.GITHUB && path.includes(`/connector/${item.id}`))
        );
        if (isGithub) {
          setActiveNav('github');
        }
      }
    } else if (path === '/twitter') {
      setActiveNav('x');
    }
  }, [location.pathname, setActiveNav, view]);

  const isSearchActive = location.pathname === '/search';

  return (
    <div className="primary-nav">
      {/* Logo Area */}
      <Link className="primary-nav-logo" to={navItems[0].path}>
        <img src="/favicon-32x32.png" alt="Huntly" />
      </Link>

      {/* Navigation Items */}
      <div className="primary-nav-items">
        {navItems
          .filter((item) => item.condition !== false)
          .map((item) => (
            <Link
              key={item.id}
              className={`primary-nav-item ${activeNav === item.id ? 'active' : ''}`}
              to={item.path}
            >
              <div className="primary-nav-item-icon-wrapper">
                <div className="primary-nav-item-icon">
                  {activeNav === item.id && item.activeIcon ? item.activeIcon : item.icon}
                </div>
              </div>
              <span className="primary-nav-item-label">{item.label}</span>
            </Link>
          ))}

        {/* Search Button - Last in nav items */}
        <Link
          className={`primary-nav-item ${isSearchActive ? 'active' : ''}`}
          to="/search"
        >
          <div className="primary-nav-item-icon-wrapper">
            <div className="primary-nav-item-icon">
              <SearchIcon />
            </div>
          </div>
          <span className="primary-nav-item-label">Search</span>
        </Link>
      </div>

      {/* Settings Button - Bottom, icon only */}
      <div className="primary-nav-settings" onClick={openSettingModal}>
        <SettingsOutlinedIcon />
      </div>

      <SettingModal open={settingModalOpen} onClose={closeSettingModal} />
    </div>
  );
};

export default PrimaryNavigation;
