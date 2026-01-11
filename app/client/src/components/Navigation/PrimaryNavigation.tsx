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
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import { useNavigation, PrimaryNavItem } from '../../contexts/NavigationContext';
import { useQuery } from '@tanstack/react-query';
import { ConnectorControllerApiFactory, PageControllerApiFactory } from '../../api';
import { ConnectorType } from '../../interfaces/connectorType';
import LibraryNavTree from '../Sidebar/LibraryNavTree';
import NavTreeView, { NavTreeViewItem } from '../Sidebar/NavTreeView';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import navLabels from '../Sidebar/NavLabels';
import SettingsNavTree from '../Sidebar/SettingsNavTree';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState<'saved' | 'feeds' | 'settings' | null>(null);

  const isMobile = () => window.innerWidth <= 900;

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(null);
  }, []);

  const {
    data: view,
  } = useQuery(['folder-connector-view'], async () => (await
    ConnectorControllerApiFactory().getFolderConnectorViewUsingGET()).data, {
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const {
    data: readLaterCountData,
  } = useQuery(
    ['read-later-count'],
    async () => (await PageControllerApiFactory().getReadLaterCountUsingGET()).data,
    { refetchInterval: 30000 }
  );

  const readLaterCount = readLaterCountData?.data;

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
    } else if (path.startsWith('/settings')) {
      setActiveNav('settings');
    }
  }, [location.pathname, setActiveNav, view]);

  const isSearchActive = location.pathname === '/search';
  const isSettingsActive = location.pathname.startsWith('/settings');

  // Handle nav item click - on mobile, show popup for items with secondary menu
  const handleNavClick = (e: React.MouseEvent, item: NavItemConfig) => {
    if (isMobile() && (item.id === 'saved' || item.id === 'feeds' || item.id === 'settings')) {
      e.preventDefault();
      setMobileMenuOpen(item.id as 'saved' | 'feeds' | 'settings');
    }
  };

  // Handle settings click on mobile
  const handleSettingsClick = (e: React.MouseEvent) => {
    if (isMobile()) {
      e.preventDefault();
      setMobileMenuOpen('settings');
    }
  };

  // Close mobile menu when route changes
  useEffect(() => {
    closeMobileMenu();
  }, [location.pathname, closeMobileMenu]);

  // Build feeds tree items for mobile menu
  const getFeedsTreeItems = (): NavTreeViewItem[] => {
    if (!view?.folderFeedConnectors) return [];

    let allInboxCount = 0;
    const items: NavTreeViewItem[] = [];

    view.folderFeedConnectors.forEach(folder => {
      if (folder.connectorItems && folder.connectorItems.length > 0) {
        const folderInboxCount = folder.connectorItems.reduce(
          (sum, item) => sum + (item.inboxCount || 0),
          0
        );
        allInboxCount += folderInboxCount;

        if (folder.name) {
          // Folder with items
          const folderItem: NavTreeViewItem = {
            labelText: folder.name,
            labelIcon: FolderOpenIcon,
            linkTo: `/folder/${folder.id}`,
            inboxCount: folderInboxCount,
            childItems: folder.connectorItems.map(item => ({
              labelText: item.name || '',
              labelIcon: RssFeedIcon,
              linkTo: `/connector/${item.id}`,
              inboxCount: item.inboxCount,
            })),
          };
          items.push(folderItem);
        } else {
          // Items without folder
          folder.connectorItems.forEach(item => {
            items.push({
              labelText: item.name || '',
              labelIcon: RssFeedIcon,
              linkTo: `/connector/${item.id}`,
              inboxCount: item.inboxCount,
            });
          });
        }
      }
    });

    // Add "All Feeds" at the beginning with total count
    items.unshift({
      labelText: navLabels.allFeeds.labelText,
      labelIcon: navLabels.allFeeds.labelIcon,
      linkTo: '/feeds',
      inboxCount: allInboxCount,
    });

    return items;
  };

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
              onClick={(e) => handleNavClick(e, item)}
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
      <Link
        className={`primary-nav-settings ${isSettingsActive ? 'active' : ''}`}
        to="/settings/general"
        onClick={handleSettingsClick}
      >
        <SettingsOutlinedIcon />
      </Link>

      {/* Mobile Menu Drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={mobileMenuOpen !== null}
        onClose={closeMobileMenu}
        onOpen={() => {}}
        disableSwipeToOpen={true}
        swipeAreaWidth={0}
        PaperProps={{
          sx: {
            maxHeight: '70vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            pb: '56px', // Space for bottom nav
          }
        }}
      >
        <div className="mobile-menu-drawer">
          <div className="mobile-menu-handle" />
          <div className="mobile-menu-content">
            {mobileMenuOpen === 'saved' && (
              <>
                <div className="mobile-menu-header">Library</div>
                <LibraryNavTree
                  selectedNodeId={location.pathname}
                  readLaterCount={readLaterCount}
                />
              </>
            )}
            {mobileMenuOpen === 'feeds' && (
              <>
                <div className="mobile-menu-header">Feeds</div>
                <NavTreeView
                  treeItems={getFeedsTreeItems()}
                  ariaLabel="feeds"
                  defaultExpanded={[]}
                  selectedNodeId={location.pathname}
                  emphasizeCounts={true}
                />
              </>
            )}
            {mobileMenuOpen === 'settings' && (
              <>
                <div className="mobile-menu-header">Settings</div>
                <SettingsNavTree selectedNodeId={location.pathname} />
              </>
            )}
          </div>
        </div>
      </SwipeableDrawer>
    </div>
  );
};

export default PrimaryNavigation;
