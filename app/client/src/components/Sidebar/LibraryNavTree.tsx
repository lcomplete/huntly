import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocalLibraryOutlinedIcon from "@mui/icons-material/LocalLibraryOutlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import BookmarksOutlinedIcon from "@mui/icons-material/BookmarksOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import NavTreeView from "./NavTreeView";
import * as React from "react";
import navLabels from "./NavLabels";

export default function LibraryNavTree({selectedNodeId}:{selectedNodeId:string}){
  return <NavTreeView defaultExpanded={['1']} ariaLabel={'library'} selectedNodeId={selectedNodeId} treeItems={[
    {
      ...navLabels.recently
    },
    {
      labelText: 'Library',
      labelIcon: LocalLibraryOutlinedIcon,
      childItems: [
        {
          ...navLabels.myList
        },
        {
          ...navLabels.starred
        },
        {
          ...navLabels.readLater
        },
        {
          ...navLabels.archive
        },
      ]
    },
  ]}></NavTreeView>;
}