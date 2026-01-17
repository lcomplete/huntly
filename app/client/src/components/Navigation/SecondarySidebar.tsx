import React from "react";
import "./SecondarySidebar.css";
import { useLocation } from "react-router-dom";
import { useNavigation, PrimaryNavItem } from "../../contexts/NavigationContext";

import { LibraryNav } from "./Library";
import { FeedsNav } from "./Feeds";
import { SettingsNav } from "./Settings";

// Navigation items that have a secondary sidebar
const SIDEBAR_NAV_ITEMS = new Set<PrimaryNavItem>(['saved', 'feeds', 'settings']);

// Wrapper component for consistent sidebar structure
const SidebarWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="secondary-sidebar">
    <div className="secondary-sidebar-content">
      {children}
    </div>
  </div>
);

const SecondarySidebar: React.FC = () => {
  const { activeNav } = useNavigation();
  const location = useLocation();

  // Only render for navigation items that have secondary sidebars
  if (!SIDEBAR_NAV_ITEMS.has(activeNav)) {
    return null;
  }

  return (
    <SidebarWrapper>
      {activeNav === 'saved' && <LibraryNav />}
      {activeNav === 'feeds' && <FeedsNav />}
      {activeNav === 'settings' && <SettingsNav selectedNodeId={location.pathname} showHeader />}
    </SidebarWrapper>
  );
};

export default SecondarySidebar;
