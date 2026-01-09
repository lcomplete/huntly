import React, { useCallback, useEffect, useState } from 'react';
import "./PrimaryNavigation.css";
import { useNavigate, useLocation } from 'react-router-dom';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HomeIcon from '@mui/icons-material/Home';
import LocalLibraryOutlinedIcon from '@mui/icons-material/LocalLibraryOutlined';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import TwitterIcon from '@mui/icons-material/Twitter';
import GitHubIcon from '@mui/icons-material/GitHub';
import SearchIcon from '@mui/icons-material/Search';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useNavigation, PrimaryNavItem } from '../../contexts/NavigationContext';
import { useQuery } from '@tanstack/react-query';
import { ConnectorControllerApiFactory } from '../../api';
import { ConnectorType } from '../../interfaces/connectorType';
import SettingModal from '../SettingModal';

interface NavItemConfig {
  id: PrimaryNavItem;
  icon: React.ReactElement;
  activeIcon?: React.ReactElement;
  label: string;
  path: string;
  condition?: boolean;
}

const PrimaryNavigation: React.FC = () => {
  const navigate = useNavigate();
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
      icon: <TwitterIcon />,
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

  const handleNavClick = (item: NavItemConfig) => {
    setActiveNav(item.id);
    navigate(item.path);
  };

  const isSearchActive = location.pathname === '/search';

  return (
    <div className="primary-nav">
      {/* Logo Area */}
      <div className="primary-nav-logo" onClick={() => handleNavClick(navItems[0])}>
        <img src="/favicon-32x32.png" alt="Huntly" />
      </div>

      {/* Navigation Items */}
      <div className="primary-nav-items">
        {navItems
          .filter((item) => item.condition !== false)
          .map((item) => (
            <div
              key={item.id}
              className={`primary-nav-item ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item)}
            >
              <div className="primary-nav-item-icon-wrapper">
                <div className="primary-nav-item-icon">
                  {activeNav === item.id && item.activeIcon ? item.activeIcon : item.icon}
                </div>
              </div>
              <span className="primary-nav-item-label">{item.label}</span>
            </div>
          ))}

        {/* Search Button - Last in nav items */}
        <div
          className={`primary-nav-item ${isSearchActive ? 'active' : ''}`}
          onClick={() => navigate('/search')}
        >
          <div className="primary-nav-item-icon-wrapper">
            <div className="primary-nav-item-icon">
              <SearchIcon />
            </div>
          </div>
          <span className="primary-nav-item-label">Search</span>
        </div>
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
