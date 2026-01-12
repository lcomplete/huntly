import React from "react";
import "./SecondarySidebar.css";
import { IconButton } from "@mui/material";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { useQuery } from "@tanstack/react-query";
import { ConnectorControllerApiFactory, ConnectorItem, FolderConnectors, PageControllerApiFactory } from "../../api";
import NavTreeView, { NavTreeViewItem } from "../Sidebar/NavTreeView";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import RssFeedIcon from "@mui/icons-material/RssFeed";
import { Link, useLocation } from "react-router-dom";
import navLabels from "../Sidebar/NavLabels";
import { ConnectorType } from "../../interfaces/connectorType";
import { useNavigation } from "../../contexts/NavigationContext";
import LibraryNavTree from "../Sidebar/LibraryNavTree";
import SettingsNavTree from "../Sidebar/SettingsNavTree";

function leadingHeader(leadingText: string, showAction = true, actionLink?: string) {
  return (
    <div
      className={'secondary-sidebar-header flex items-center'}
    >
      <div style={{
        flex: 1,
        fontSize: '14px',
        fontWeight: 600,
        color: '#334155',
        letterSpacing: '0.01em',
      }}>
        {leadingText}
      </div>
      {showAction && actionLink && (
        <Link to={actionLink}>
          <IconButton
            size="small"
            sx={{
              width: 24,
              height: 24,
              bgcolor: 'transparent',
              borderRadius: '5px',
              transition: 'color 0.15s ease',
              color: '#94a3b8',
              '&:hover': {
                color: '#64748b',
              },
            }}
          >
            <SettingsOutlinedIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Link>
      )}
    </div>
  );
}

function sumInboxCount(connectorItems: Array<ConnectorItem>) {
  return connectorItems.reduce((sum, cur) => sum + (cur.inboxCount || 0), 0);
}

function connectorToTreeItems(connectorItems: Array<ConnectorItem>): NavTreeViewItem[] {
  return connectorItems.map((connectorItem) => {
    const icon = connectorItem.type === ConnectorType.RSS ? RssFeedIcon : navLabels.github.labelIcon;
    return {
      labelText: connectorItem.name,
      labelIcon: icon,
      linkTo: "/connector/" + connectorItem.id,
      inboxCount: connectorItem.inboxCount,
      iconUrl: connectorItem.iconUrl,
    };
  });
}

function folderConnectorsToTreeItems(folderConnectorsArray: FolderConnectors[], isRss: boolean) {
  let treeItems: NavTreeViewItem[] = [];

  let allInboxCount = 0;
  folderConnectorsArray.forEach((folderConnectors) => {
    const folderInBoxCount = sumInboxCount(folderConnectors.connectorItems);
    allInboxCount += folderInBoxCount;
    if (folderConnectors.id && folderConnectors.name) {
      const item: NavTreeViewItem = {
        linkTo: '/folder/' + folderConnectors.id,
        labelIcon: FolderOpenIcon,
        labelText: folderConnectors.name,
        inboxCount: folderInBoxCount,
        childItems: connectorToTreeItems(folderConnectors.connectorItems),
      };
      treeItems.push(item);
    } else {
      const partItems = connectorToTreeItems(folderConnectors.connectorItems);
      treeItems.push(...partItems);
    }
  });

  if (isRss) {
    const rssItems = [];
    rssItems.push(
      {
        ...navLabels.allFeeds,
        inboxCount: allInboxCount,
      },
      ...treeItems
    );
    treeItems = rssItems;
  } else {
    const connectorItems = [];
    connectorItems.push(
      {
        ...navLabels.twitter,
      },
      ...treeItems
    );
    treeItems = connectorItems;
  }
  return treeItems;
}

// Feeds content component - only mounts when feeds nav is active
const FeedsContent: React.FC = () => {
  const location = useLocation();

  const { data: view } = useQuery(
    ['folder-connector-view'],
    async () => (await ConnectorControllerApiFactory().getFolderConnectorViewUsingGET()).data,
    {
      refetchInterval: 5000,
    }
  );

  const treeItems = view?.folderFeedConnectors
    ? folderConnectorsToTreeItems(view.folderFeedConnectors, true)
    : [];

  return (
    <>
      {leadingHeader('Feeds', true, '/settings/feeds')}
      {treeItems.length > 0 && (
        <NavTreeView
          treeItems={treeItems}
          ariaLabel="rss"
          defaultExpanded={[]}
          selectedNodeId={location.pathname}
          emphasizeCounts={true}
        />
      )}
    </>
  );
};

// Saved content component - only mounts when saved nav is active
const SavedContent: React.FC = () => {
  const location = useLocation();

  const { data: readLaterCountData } = useQuery(
    ['read-later-count'],
    async () => (await PageControllerApiFactory().getReadLaterCountUsingGET()).data,
    {
      refetchInterval: 30000,
    }
  );

  const readLaterCount = readLaterCountData?.data;

  return (
    <>
      {leadingHeader('Library', false)}
      <LibraryNavTree selectedNodeId={location.pathname} readLaterCount={readLaterCount} />
    </>
  );
};

// Settings content component
const SettingsContent: React.FC = () => {
  const location = useLocation();

  return (
    <>
      {leadingHeader('Settings', false)}
      <SettingsNavTree selectedNodeId={location.pathname} />
    </>
  );
};

const SecondarySidebar: React.FC = () => {
  const { activeNav } = useNavigation();

  // Render content based on active navigation
  // Each content component is only mounted when its nav is active,
  // so useQuery hooks inside them only run when needed
  switch (activeNav) {
    case 'saved':
      return (
        <div className="secondary-sidebar">
          <div className="secondary-sidebar-content">
            <SavedContent />
          </div>
        </div>
      );

    case 'feeds':
      return (
        <div className="secondary-sidebar">
          <div className="secondary-sidebar-content">
            <FeedsContent />
          </div>
        </div>
      );

    case 'settings':
      return (
        <div className="secondary-sidebar">
          <div className="secondary-sidebar-content">
            <SettingsContent />
          </div>
        </div>
      );

    case 'home':
    case 'x':
    case 'github':
    default:
      return null;
  }
};

export default SecondarySidebar;
