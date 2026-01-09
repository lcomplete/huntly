import React, { useCallback, useState } from "react";
import "./SecondarySidebar.css";
import { IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useQuery } from "@tanstack/react-query";
import { ConnectorControllerApiFactory, ConnectorItem, FolderConnectors } from "../../api";
import NavTreeView, { NavTreeViewItem } from "../Sidebar/NavTreeView";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import RssFeedIcon from "@mui/icons-material/RssFeed";
import { useLocation } from "react-router-dom";
import navLabels from "../Sidebar/NavLabels";
import { ConnectorType } from "../../interfaces/connectorType";
import SettingModal from "../SettingModal";
import { useNavigation } from "../../contexts/NavigationContext";
import LibraryNavTree from "../Sidebar/LibraryNavTree";

const SecondarySidebar: React.FC = () => {
  const location = useLocation();
  const { activeNav } = useNavigation();

  function leadingHeader(leadingText: string, showAction = true) {
    return (
      <div
        className={'flex items-center'}
        style={{
          padding: '16px 10px 12px 10px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
          marginBottom: 4,
        }}
      >
        <div style={{
          flex: 1,
          fontSize: '15px',
          fontWeight: 700,
          color: '#1e293b',
          letterSpacing: '-0.01em',
        }}>
          {leadingText}
        </div>
        {showAction && (
          <IconButton
            onClick={() => {
              if (leadingText === 'Connect') {
                openConnectSettingModal();
              } else {
                openFeedsSettingModal();
              }
            }}
            size="small"
            sx={{
              width: 24,
              height: 24,
              bgcolor: 'transparent',
              borderRadius: '5px',
              transition: 'background-color 0.15s ease',
              '&:hover': {
                bgcolor: 'rgba(100, 116, 139, 0.10)',
              },
            }}
          >
            <AddIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
          </IconButton>
        )}
      </div>
    );
  }

  function folderConnectorsView(folderConnectorsArray: FolderConnectors[], isRss: boolean) {
    const treeItems = folderConnectorsToTreeItems(folderConnectorsArray, isRss);
    return (
      <NavTreeView
        treeItems={treeItems}
        ariaLabel={isRss ? 'rss' : 'connectors'}
        defaultExpanded={[]}
        selectedNodeId={location.pathname}
        emphasizeCounts={isRss}
      />
    );
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

  const {
    isLoading,
    error,
    data: view,
  } = useQuery(
    ['folder-connector-view'],
    async () => (await ConnectorControllerApiFactory().getFolderConnectorViewUsingGET()).data,
    {
      refetchInterval: 5000,
      refetchIntervalInBackground: true,
    }
  );

  const [settingModalOpen, setSettingModalOpen] = useState(false);
  const [settingIndex, setSettingIndex] = useState(0);

  const openConnectSettingModal = useCallback(() => {
    setSettingIndex(2);
    setSettingModalOpen(true);
  }, []);

  const openFeedsSettingModal = useCallback(() => {
    setSettingIndex(3);
    setSettingModalOpen(true);
  }, []);

  const closeSettingModal = useCallback(() => {
    setSettingModalOpen(false);
  }, []);

  const readLaterCount = 10;

  // Determine which content to show based on active navigation
  const renderContent = () => {
    switch (activeNav) {
      case 'saved':
        return (
          <>
            {leadingHeader('Library', false)}
            <LibraryNavTree selectedNodeId={location.pathname} readLaterCount={readLaterCount} />
          </>
        );

      case 'feeds':
        return (
          <>
            {leadingHeader('Feeds')}
            {view && view.folderFeedConnectors && folderConnectorsView(view.folderFeedConnectors, true)}
          </>
        );

      case 'home':
      case 'x':
      case 'github':
      default:
        return null;
    }
  };

  const content = renderContent();

  // If there's no content to show, don't render the sidebar
  if (!content) {
    return null;
  }

  return (
    <div className="secondary-sidebar pb-14">
      {content}
      {settingModalOpen && (
        <SettingModal open={settingModalOpen} onClose={closeSettingModal} defaultIndex={settingIndex} />
      )}
    </div>
  );
};

export default SecondarySidebar;
