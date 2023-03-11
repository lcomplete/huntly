import React, {useEffect} from "react";
import {
  createBrowserRouter,
  createRoutesFromElements, createSearchParams,
  Route,
  RouterProvider,
} from "react-router-dom";
import Layout from "./components/Layout";
import Index from "./pages/Index";
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
import {AuthControllerApiFactory} from "./api";
import SignIn from "./pages/SignIn";

function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route>
        <Route path="/signin" element={<SignIn/>}/>
        <Route element={<Layout/>}>
          <Route index element={<Index/>}/>
          <Route path={"/list"} element={<MyList/>}/>
          <Route path={"/starred"} element={<Starred/>}/>
          <Route path={"/later"} element={<ReadLater/>}/>
          <Route path={"/archive"} element={<Archive/>}/>
          <Route path="/page/:id" element={<Page/>}/>
          <Route path="/connector/:id" element={<ConnectorList/>}/>
          <Route path="/folder/:id" element={<FolderList/>}/>
          <Route path="/feeds" element={<AllFeeds/>}/>
          <Route path="/search" element={<Search/>}/>
          <Route path="/twitter" element={<Twitter/>}/>
        </Route>
      </Route>
    )
  );

  useEffect(() => {
    const location = window.location;
    if (location.pathname !== '/signin' && location.pathname !== "signup") {
      AuthControllerApiFactory().loginUserInfoUsingGET().then((res) => {
        if (res.data.username === null) {
          window.location.href = `/signin?${createSearchParams({
            'from': location.pathname,
          })}`;
        }
      });
    }
  }, []);

  return (
    <RouterProvider router={router}/>
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
