import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { ConnectorControllerApiFactory, ConnectorItem, FolderConnectors } from "../../../api";
import NavTreeView, { NavTreeViewItem } from "../shared/NavTreeView";
import SidebarHeader from "../shared/SidebarHeader";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import RssFeedIcon from "@mui/icons-material/RssFeed";
import navLabels from "../shared/NavLabels";
import { ConnectorType } from "../../../interfaces/connectorType";

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

function folderConnectorsToTreeItems(folderConnectorsArray: FolderConnectors[]) {
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

  const rssItems = [];
  rssItems.push(
    {
      ...navLabels.allFeeds,
      inboxCount: allInboxCount,
    },
    ...treeItems
  );
  return rssItems;
}

const FeedsNav: React.FC = () => {
  const location = useLocation();

  const { data: view } = useQuery(
    ['folder-connector-view'],
    async () => (await ConnectorControllerApiFactory().getFolderConnectorViewUsingGET()).data,
    {
      refetchInterval: 5000,
    }
  );

  const treeItems = view?.folderFeedConnectors
    ? folderConnectorsToTreeItems(view.folderFeedConnectors)
    : [];

  return (
    <>
      <SidebarHeader title="Feeds" actionLink="/settings/feeds" />
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

export default FeedsNav;

