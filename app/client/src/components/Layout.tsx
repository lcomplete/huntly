import React from "react";
import {CssBaseline, StyledEngineProvider} from "@mui/material";
import Sidebar from "./Sidebar/Sidebar";
import {Outlet, ScrollRestoration} from "react-router-dom";
import Header from "./Header";

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
      <div className="h-full layoutRoot">
        <Header />

        <div className="main_window flex flex-row">
          <div className="main_sidebar">
            <Sidebar/>
          </div>
          <div className="flex-auto">
            <Outlet/>
          </div>
        </div>

      </div>
    </StyledEngineProvider>
  );
};

export default Layout;
