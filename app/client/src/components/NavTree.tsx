import * as React from 'react';
import {styled} from '@mui/material/styles';
import Box from '@mui/material/Box';
import TreeView from '@mui/lab/TreeView';
import TreeItem, {TreeItemProps, treeItemClasses} from '@mui/lab/TreeItem';
import Typography from '@mui/material/Typography';
import LocalLibraryOutlinedIcon from '@mui/icons-material/LocalLibraryOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import MailIcon from '@mui/icons-material/Mail';
import DeleteIcon from '@mui/icons-material/Delete';
import Label from '@mui/icons-material/Label';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import InfoIcon from '@mui/icons-material/Info';
import ForumIcon from '@mui/icons-material/Forum';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import {SvgIconProps} from '@mui/material/SvgIcon';
import StarBorderIcon from "@mui/icons-material/StarBorder";
import StarIcon from '@mui/icons-material/Star';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import {IconButton} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LabelImportantIcon from '@mui/icons-material/LabelImportant';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import BallotOutlinedIcon from '@mui/icons-material/BallotOutlined';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import ArchiveIcon from '@mui/icons-material/Archive';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import {Link} from "react-router-dom";

declare module 'react' {
  interface CSSProperties {
    '--tree-view-color'?: string;
    '--tree-view-bg-color'?: string;
  }
}

type StyledTreeItemProps = TreeItemProps & {
  bgColor?: string;
  color?: string;
  labelIcon: React.ElementType<SvgIconProps>;
  labelInfo?: string;
  labelText: string;
};

const StyledTreeItemRoot = styled(TreeItem)(({theme}) => ({
  color: theme.palette.text.primary,
  [`& .${treeItemClasses.content}`]: {
    color: theme.palette.text.primary,
    borderTopRightRadius: theme.spacing(2),
    borderBottomRightRadius: theme.spacing(2),
    paddingRight: theme.spacing(1),
    fontWeight: theme.typography.fontWeightMedium,
    '&.Mui-expanded': {
      fontWeight: theme.typography.fontWeightRegular,
    },
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&.Mui-focused, &.Mui-selected, &.Mui-selected.Mui-focused': {
      backgroundColor: `var(--tree-view-bg-color, ${theme.palette.action.selected})`,
      color: 'var(--tree-view-color)',
      fontWeight: theme.typography.fontWeightBold,
    },
    [`& .${treeItemClasses.label}`]: {
      fontWeight: 'inherit',
      color: 'inherit',
      paddingLeft: 0
    },
    [`& .${treeItemClasses.iconContainer}`]: {
      marginRight: 0,
    },
    [`& .${treeItemClasses.root}`]: {
      paddingLeft: 0,
    },
  },

  [`& .${treeItemClasses.group}`]: {
    marginLeft: 0,
    [`& .${treeItemClasses.content}`]: {
      paddingLeft: theme.spacing(2),
    },
  },
}));

function StyledTreeItem(props: StyledTreeItemProps) {
  const {
    bgColor,
    color,
    labelIcon: LabelIcon,
    labelInfo,
    labelText,
    ...other
  } = props;

  return (
    <StyledTreeItemRoot
      label={
        <Box sx={{display: 'flex', alignItems: 'center', p: 0.5, pr: 0, pl: 0}}>
          <Box component={LabelIcon} color="inherit" sx={{mr: 1}}/>
          <Typography variant="body2" sx={{fontWeight: 'inherit', flexGrow: 1}}>
            {labelText}
          </Typography>
          <Typography variant="caption" color="inherit" className={'leading-4'}>
            {labelInfo}
          </Typography>
        </Box>
      }
      style={{
        '--tree-view-color': color || '#202124',
        '--tree-view-bg-color': bgColor || '#d3e3fd',
      }}
      {...other}
    />
  );
}

export default function GmailTreeView() {
  return (
    <>
      {/*<TreeView*/}
      {/*  aria-label="huntly"*/}
      {/*  defaultExpanded={['2']}*/}
      {/*  defaultCollapseIcon={<ArrowDropDownIcon/>}*/}
      {/*  defaultExpandIcon={<ArrowRightIcon/>}*/}
      {/*  defaultEndIcon={<div style={{width: 24}}/>}*/}
      {/*  sx={{flexGrow: 1, overflowY: 'auto'}}*/}
      {/*>*/}
      {/*  <Link to={"/"}>*/}
      {/*    <StyledTreeItem nodeId="1" labelText="Recently Read" labelIcon={AccessTimeIcon}/>*/}
      {/*  </Link>*/}
      {/*  <StyledTreeItem nodeId="2" labelText="Library" labelIcon={LocalLibraryOutlinedIcon}>*/}
      {/*    <Link to={"/list"}>*/}
      {/*      <StyledTreeItem*/}
      {/*        nodeId="3"*/}
      {/*        labelText="My List"*/}
      {/*        labelIcon={FormatListBulletedIcon}*/}
      {/*        // color="#1a73e8"*/}
      {/*        // bgColor="#e8f0fe"*/}
      {/*      />*/}
      {/*    </Link>*/}
      {/*    <Link to={"/starred"}>*/}
      {/*      <StyledTreeItem*/}
      {/*        nodeId="4"*/}
      {/*        labelText="Starred"*/}
      {/*        labelIcon={AutoAwesomeOutlinedIcon}*/}
      {/*      />*/}
      {/*    </Link>*/}
      {/*    <Link to={"/later"}>*/}
      {/*      <StyledTreeItem*/}
      {/*        nodeId="5"*/}
      {/*        labelText="Read Later"*/}
      {/*        labelIcon={BookmarksOutlinedIcon}*/}
      {/*      />*/}
      {/*    </Link>*/}
      {/*    <Link to={"/archive"}>*/}
      {/*      <StyledTreeItem*/}
      {/*        nodeId="6"*/}
      {/*        labelText="Archive"*/}
      {/*        labelIcon={ArchiveOutlinedIcon}*/}
      {/*      />*/}
      {/*    </Link>*/}
      {/*  </StyledTreeItem>*/}
      {/*</TreeView>*/}

      <div className={'pt-2 pl-6 pb-2 flex items-center'}>
        <div className={'grow text-base leading-4 font-medium text-gray-400'}>
          CONNECT
        </div>
        <div>
          <IconButton>
            <AddIcon fontSize={"small"} className={"text-gray-400"}/>
          </IconButton>
        </div>
      </div>

      <TreeView
        aria-label="huntly"
        defaultCollapseIcon={<ArrowDropDownIcon/>}
        defaultExpandIcon={<ArrowRightIcon/>}
        defaultEndIcon={<div style={{width: 24}}/>}
        sx={{flexGrow: 1, overflowY: 'auto'}}
      >
        <Link to={'/connector/1'}>
          <StyledTreeItem nodeId="1" labelText="GitHub" labelIcon={LabelImportantIcon}/>
        </Link>
        <StyledTreeItem nodeId="2" labelText="Twitter" labelIcon={LabelImportantIcon}/>
        <StyledTreeItem nodeId="3" labelText="StackOverflow" labelIcon={LabelImportantIcon}/>
        <StyledTreeItem nodeId="4" labelText="Pocket" labelIcon={LabelImportantIcon}/>
        <StyledTreeItem nodeId="5" labelText="Obsidian" labelIcon={LabelImportantIcon}/>
      </TreeView>

      <div className={'pt-2 pl-6 pb-2 flex items-center'}>
        <div className={'grow text-base leading-4 font-medium text-gray-400'}>
          FEEDS
        </div>
        <div>
          <IconButton>
            <AddIcon fontSize={"small"} className={"text-gray-400"}/>
          </IconButton>
        </div>
      </div>

      <TreeView
        aria-label="huntly"
        defaultExpanded={['2']}
        defaultCollapseIcon={<ArrowDropDownIcon/>}
        defaultExpandIcon={<ArrowRightIcon/>}
        defaultEndIcon={<div style={{width: 24}}/>}
        sx={{flexGrow: 1, overflowY: 'auto'}}
      >
        <StyledTreeItem nodeId="1" labelText="All Articles" labelIcon={BallotOutlinedIcon}/>
        <StyledTreeItem nodeId="2" labelText="博客" labelIcon={FolderOpenIcon}>
          <Link to={"/connector/2"}>
            <StyledTreeItem
              nodeId="3"
              labelText="CoolShell"
              labelIcon={RssFeedIcon}
              labelInfo="1"
              // color="#1a73e8"
              // bgColor="#e8f0fe"
            />
          </Link>
          <Link to={"/connector/6"}>
            <StyledTreeItem
              nodeId="4"
              labelText="阮一峰的网络日志"
              labelIcon={RssFeedIcon}
              // color="#e3742f"
              // bgColor="#fcefe3"
            />
          </Link>
        </StyledTreeItem>
      </TreeView>
    </>
  );
}
