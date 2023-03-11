import LocalLibraryOutlinedIcon from "@mui/icons-material/LocalLibraryOutlined";
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