import React, { useCallback, useEffect, useState, useMemo } from 'react';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ConnectorControllerApiFactory, FolderConnectorView, PageControllerApiFactory, ConnectorItem } from '../../api';
import { ConnectorType } from '../../interfaces/connectorType';
import { LibraryNavTree, CollectionTree, CollectionContextMenu, GroupContextMenu } from './Library';
import { CollectionApi, CollectionTreeVO, CollectionVO } from '../../api/collectionApi';
import { useCollectionDialogs } from './Library/hooks';
import CollectionEditDialog from '../Dialogs/CollectionEditDialog';
import DeleteCollectionDialog from '../Dialogs/DeleteCollectionDialog';
import GroupEditDialog from '../Dialogs/GroupEditDialog';
import NavTreeView, { NavTreeViewItem } from './shared/NavTreeView';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import navLabels from './shared/NavLabels';
import { SettingsNav } from './Settings';

// Helper to find sibling collection names (duplicated from LibraryNav for mobile use)
function findSiblingNames(
  treeData: CollectionTreeVO | undefined,
  groupId: number | undefined,
  parentId: number | undefined
): string[] {
  if (!treeData || !groupId) return [];

  const group = treeData.groups.find(g => g.id === groupId);
  if (!group) return [];

  if (parentId) {
    // Find parent collection and get its children's names
    const findInChildren = (collections: CollectionVO[]): string[] => {
      for (const c of collections) {
        if (c.id === parentId) {
          return c.children.map(child => child.name);
        }
        const found = findInChildren(c.children);
        if (found.length > 0) return found;
      }
      return [];
    };
    return findInChildren(group.collections);
  } else {
    // Top-level collections in this group
    return group.collections.map(c => c.name);
  }
}

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

// Mobile menu content for Library - fetches data only when mounted
const MobileLibraryContent: React.FC<{ selectedNodeId: string }> = ({ selectedNodeId }) => {
  const dialogs = useCollectionDialogs();

  const { data: readLaterCountData } = useQuery(
    ['read-later-count'],
    async () => (await PageControllerApiFactory().getReadLaterCountUsingGET()).data,
  );

  const { data: treeData } = useQuery<CollectionTreeVO>(
    ['collections-tree'],
    async () => await CollectionApi.getTree(),
    { refetchInterval: 30000 }
  );

  // Calculate sibling names for duplicate validation
  const siblingNames = useMemo(() => {
    return findSiblingNames(treeData, dialogs.editingGroupId, dialogs.editingParentId);
  }, [treeData, dialogs.editingGroupId, dialogs.editingParentId]);

  return (
    <>
      <div className="mobile-menu-header">Library</div>
      <LibraryNavTree
        selectedNodeId={selectedNodeId}
        readLaterCount={readLaterCountData?.data}
      />

      <CollectionTree
        selectedNodeId={selectedNodeId}
        treeData={treeData || null}
        onCollectionContextMenu={dialogs.openCollectionMenu}
        onGroupContextMenu={dialogs.openGroupMenu}
        onAddGroup={dialogs.openAddGroup}
      />

      {/* Dialogs */}
      <CollectionEditDialog
        open={dialogs.editDialogOpen}
        collection={dialogs.editingCollection}
        siblingNames={siblingNames}
        onClose={dialogs.closeEditDialog}
        onSave={dialogs.saveCollection}
      />

      <DeleteCollectionDialog
        open={dialogs.deleteDialogOpen}
        collection={dialogs.deletingCollection}
        onClose={dialogs.closeDeleteDialog}
        onConfirm={dialogs.confirmDelete}
      />

      <GroupEditDialog
        open={dialogs.groupEditDialogOpen}
        group={dialogs.editingGroup}
        error={dialogs.groupError}
        onClose={dialogs.closeGroupEditDialog}
        onSave={dialogs.saveGroup}
      />

      {/* Context Menus */}
      <CollectionContextMenu
        contextMenu={dialogs.collectionContextMenu}
        onClose={dialogs.closeCollectionMenu}
        onEdit={dialogs.openEditCollection}
        onDelete={dialogs.openDeleteCollection}
        onAddSubCollection={dialogs.openAddSubCollection}
      />

      <GroupContextMenu
        contextMenu={dialogs.groupContextMenu}
        onClose={dialogs.closeGroupMenu}
        onEdit={dialogs.openEditGroup}
        onDelete={dialogs.deleteGroup}
        onAddCollection={dialogs.addCollectionFromGroup}
        onAddGroup={dialogs.openAddGroup}
      />
    </>
  );
};

// Mobile menu content for Feeds - fetches data only when mounted
const MobileFeedsContent: React.FC<{ selectedNodeId: string }> = ({ selectedNodeId }) => {
  const { data: view } = useQuery(
    ['folder-connector-view'],
    async () => (await ConnectorControllerApiFactory().getFolderConnectorViewUsingGET()).data,
  );

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

    items.unshift({
      labelText: navLabels.allFeeds.labelText,
      labelIcon: navLabels.allFeeds.labelIcon,
      linkTo: '/feeds',
      inboxCount: allInboxCount,
    });

    return items;
  };

  return (
    <>
      <div className="mobile-menu-header">Feeds</div>
      <NavTreeView
        treeItems={getFeedsTreeItems()}
        ariaLabel="feeds"
        defaultExpanded={[]}
        selectedNodeId={selectedNodeId}
        emphasizeCounts={true}
      />
    </>
  );
};

// Mobile menu content for Settings
const MobileSettingsContent: React.FC<{ selectedNodeId: string }> = ({ selectedNodeId }) => {
  return (
    <>
      <div className="mobile-menu-header">Settings</div>
      <SettingsNav selectedNodeId={selectedNodeId} />
    </>
  );
};

// Helper to determine active nav from path and view data
const getActiveNavFromPath = (
  path: string,
  view: FolderConnectorView | undefined,
  githubConnector: ConnectorItem | null | undefined
): PrimaryNavItem | null => {
  if (path === '/search') return null;
  if (path.startsWith('/page/')) return null;
  if (path === '/' || path === '/recently-read') return 'home';
  if (['/list', '/starred', '/later', '/archive', '/highlights'].includes(path)) return 'saved';
  if (path.startsWith('/collection/')) return 'saved';
  if (path === '/feeds') return 'feeds';
  if (path === '/twitter') return 'x';
  if (path.startsWith('/settings')) return 'settings';

  if (path.startsWith('/folder/') || path.startsWith('/connector/')) {
    const isRssFeed = view?.folderFeedConnectors?.some(folder =>
      folder.connectorItems?.some(item => path.includes(`/connector/${item.id}`)) ||
      (folder.id && path === `/folder/${folder.id}`)
    );
    if (isRssFeed) return 'feeds';

    // Check if this is the GitHub connector path
    if (githubConnector && path.includes(`/connector/${githubConnector.id}`)) {
      return 'github';
    }
  }

  return null;
};

const PrimaryNavigation: React.FC = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { activeNav, setActiveNav } = useNavigation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<'saved' | 'feeds' | 'settings' | null>(null);

  const isMobile = () => window.innerWidth <= 900;

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(null);
  }, []);

  // Fetch folder-connector view data for feed connectors
  const { data: view } = useQuery(
    ['folder-connector-view'],
    async () => (await ConnectorControllerApiFactory().getFolderConnectorViewUsingGET()).data,
  );

  // Fetch GitHub connector information
  const { data: firstGithubConnector } = useQuery(
    ['github-connector'],
    async () => (await ConnectorControllerApiFactory().getGitHubConnectorUsingGET()).data,
  );

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
    const newActiveNav = getActiveNavFromPath(location.pathname, view, firstGithubConnector);
    if (newActiveNav !== null) {
      setActiveNav(newActiveNav);
    } else if (location.pathname === '/search' || location.pathname.startsWith('/page/')) {
      setActiveNav(null);
    }
  }, [location.pathname, setActiveNav, view, firstGithubConnector]);

  const isSearchActive = location.pathname === '/search';
  const isSettingsActive = location.pathname.startsWith('/settings');

  // Handle nav item click - on mobile, show popup for items with secondary menu
  const handleNavClick = (e: React.MouseEvent, item: NavItemConfig) => {
    if (isMobile() && (item.id === 'saved' || item.id === 'feeds' || item.id === 'settings')) {
      e.preventDefault();
      setMobileMenuOpen(item.id);
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
        onOpen={() => { }}
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
              <MobileLibraryContent selectedNodeId={location.pathname} />
            )}
            {mobileMenuOpen === 'feeds' && (
              <MobileFeedsContent selectedNodeId={location.pathname} />
            )}
            {mobileMenuOpen === 'settings' && (
              <MobileSettingsContent selectedNodeId={location.pathname} />
            )}
          </div>
        </div>
      </SwipeableDrawer>
    </div>
  );
};

export default PrimaryNavigation;
