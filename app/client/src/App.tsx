import React, { useEffect } from "react";
import {
  createBrowserRouter,
  createRoutesFromElements, createSearchParams,
  Route,
  RouterProvider,
} from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import RecentlyRead from "./pages/RecentlyRead";
import Page from "./pages/Page";
import MyList from "./pages/MyList";
import Starred from "./pages/Starred";
import ReadLater from "./pages/ReadLater";
import Archive from "./pages/Archive";
import ConnectorList from "./pages/ConnectorList";
import FolderList from "./pages/FolderList";
import AllFeeds from "./pages/AllFeeds";
import Search from "./pages/Search";
import Twitter from "./pages/Twitter";
import Highlights from "./pages/Highlights";
import CollectionList from "./pages/CollectionList";
import { AuthControllerApiFactory } from "./api";
import SignIn from "./pages/SignIn";
import { GlobalSettingsProvider } from "./contexts/GlobalSettingsContext";
import Settings from "./pages/settings";
import SettingsGeneral from "./pages/settings/SettingsGeneral";
import SettingsHuntlyAI from "./pages/settings/SettingsHuntlyAI";
import SettingsFeeds from "./pages/settings/SettingsFeeds";
import SettingsLibrary from "./pages/settings/SettingsLibrary";
import SettingsAccount from "./pages/settings/SettingsAccount";
import SettingsGithub from "./pages/settings/SettingsGithub";
import SettingsX from "./pages/settings/SettingsX";

function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route>
        <Route path="/signin" element={<SignIn />} />
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path={"/recently-read"} element={<RecentlyRead />} />
          <Route path={"/list"} element={<MyList />} />
          <Route path={"/starred"} element={<Starred />} />
          <Route path={"/later"} element={<ReadLater />} />
          <Route path={"/archive"} element={<Archive />} />
          <Route path="/page/:id" element={<Page />} />
          <Route path="/connector/:id" element={<ConnectorList />} />
          <Route path="/folder/:id" element={<FolderList />} />
          <Route path="/feeds" element={<AllFeeds />} />
          <Route path="/search" element={<Search />} />
          <Route path="/twitter" element={<Twitter />} />
          <Route path="/highlights" element={<Highlights />} />
          <Route path="/collection/:id" element={<CollectionList />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/general" element={<SettingsGeneral />} />
          <Route path="/settings/huntly-ai" element={<SettingsHuntlyAI />} />
          <Route path="/settings/library" element={<SettingsLibrary />} />
          <Route path="/settings/feeds" element={<SettingsFeeds />} />
          <Route path="/settings/x" element={<SettingsX />} />
          <Route path="/settings/github" element={<SettingsGithub />} />
          <Route path="/settings/account" element={<SettingsAccount />} />
        </Route>
      </Route>
    )
  );

  useEffect(() => {
    const location = window.location;
    // Skip auth check for public pages
    const publicPaths = ['/signin', '/signup'];
    if (!publicPaths.some(p => location.pathname.startsWith(p))) {
      AuthControllerApiFactory().loginUserInfoUsingGET().then((res) => {
        if (res.data.username === null) {
          window.location.href = `/signin?${createSearchParams({
            'from': location.pathname + location.search,
          })}`;
        }
      });
    }
  }, []);

  return (
    <GlobalSettingsProvider>
      <RouterProvider router={router} />
    </GlobalSettingsProvider>
    // <Routes>
    //   <Route path="/signin" element={<SignIn/>}/>
    //   <Route path="/" element={<Layout/>}>
    //     <Route index element={<Index/>}/>
    //     <Route path={"/list"} element={<MyList/>}/>
    //     <Route path={"/starred"} element={<Starred/>}/>
    //     <Route path={"/later"} element={<ReadLater/>}/>
    //     <Route path={"/archive"} element={<Archive/>}/>
    //     <Route path="/page/:id" element={<Page/>}/>
    //     <Route path="/connector/:id" element={<ConnectorList/>}/>
    //     <Route path="/folder/:id" element={<FolderList/>}/>
    //     <Route path="/feeds" element={<AllFeeds/>}/>
    //     <Route path="/search" element={<Search/>}/>
    //     <Route path="/twitter" element={<Twitter/>}/>
    //   </Route>
    // </Routes>
  );
}

export default App;
