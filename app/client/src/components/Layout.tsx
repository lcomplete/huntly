import React, {useEffect} from "react";
import "./Layout.css";
import {CssBaseline, StyledEngineProvider} from "@mui/material";
import {Outlet, ScrollRestoration, useLocation} from "react-router-dom";
import { NavigationProvider, useNavigation } from "../contexts/NavigationContext";
import PrimaryNavigation from "./Navigation/PrimaryNavigation";
import SecondarySidebar from "./Navigation/SecondarySidebar";

const LayoutContent = () => {
  const location = useLocation();
  const { activeNav } = useNavigation();

  useEffect(() => {
    const rootEl = document.getElementById('root');
    rootEl?.classList.remove('toggle-sidebar');
  },[location]);

  // Check if current nav has secondary sidebar
  const hasSecondarySidebar = activeNav === 'saved' || activeNav === 'feeds';

  return (
    <div className="h-full layoutRoot">
      {/* Primary nav - left column */}
      <aside className="primary-nav-container">
        <PrimaryNavigation />
      </aside>

      {/* Right section: content area */}
      <div className="layout-right">
        <div className="content-area">
          {hasSecondarySidebar && (
            <aside className="secondary-sidebar-container">
              <SecondarySidebar />
            </aside>
          )}
          <main className="main-content">
            <Outlet/>
          </main>
        </div>
      </div>
    </div>
  );
};

const Layout = () => {
  return (
    <StyledEngineProvider injectFirst>
      <CssBaseline/>
      <ScrollRestoration
        getKey={(location, matches) => {
          const paths = ["/"];
          // const paths = ["/", "/list","/starred","/later","/archive"];
          return paths.includes(location.pathname)
            ? // home and some paths restore by pathname
            location.pathname
            : // everything else by location like the browser
            location.key;
        }}
      />
      <NavigationProvider>
        <LayoutContent />
      </NavigationProvider>
    </StyledEngineProvider>
  );
};

export default Layout;
