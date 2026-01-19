import * as React from "react";
import {SvgIconProps} from "@mui/material/SvgIcon";
import SvgIcon from '@mui/material/SvgIcon';
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import BookmarksOutlinedIcon from "@mui/icons-material/BookmarksOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import GitHubIcon from "@mui/icons-material/GitHub";
import BallotOutlinedIcon from "@mui/icons-material/BallotOutlined";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import SearchIcon from '@mui/icons-material/Search';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

// X (Twitter) Icon Component
function XIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </SvgIcon>
  );
}

export type NavLabel = {
  labelText: string,
  labelIcon: React.ElementType<SvgIconProps>,
  iconColor?: string,
  linkTo?: string,
  iconUrl?: string,
  showLabel?: boolean
}

export type NavLabels = {
  home: NavLabel,
  recently: NavLabel,
  myList: NavLabel,
  starred: NavLabel,
  readLater: NavLabel,
  archive: NavLabel,
  github: NavLabel,
  allFeeds: NavLabel,
  twitter: NavLabel,
  highlights: NavLabel,
  folder: NavLabel,
  search: NavLabel,
  unsorted: NavLabel
}

export function navLabel(labelText: string, labelIcon: React.ElementType<SvgIconProps>, linkTo?: string, iconColor?: string, showLabel: boolean = true): NavLabel {
  return {
    labelText,
    labelIcon,
    linkTo,
    iconColor,
    showLabel
  };
}

const navLabels: NavLabels = {
  home: navLabel('Home', HomeOutlinedIcon, '/'),
  recently: navLabel('Recently Read', AccessTimeIcon, '/recently-read'),
  myList: navLabel('My List', FormatListBulletedIcon, '/list'),
  starred: navLabel('Starred', AutoAwesomeOutlinedIcon, '/starred'),
  readLater: navLabel('Read Later', BookmarksOutlinedIcon, '/later'),
  archive: navLabel('Archive', ArchiveOutlinedIcon, '/archive'),
  github: navLabel('GitHub', GitHubIcon),
  allFeeds: navLabel('All Feeds', BallotOutlinedIcon, '/feeds'),
  twitter: navLabel('X', XIcon, '/twitter', undefined, false),
  highlights: navLabel('Highlights', FormatQuoteIcon, '/highlights'),
  folder: navLabel('', FolderOpenIcon),
  search: navLabel('Search', SearchIcon, '/search'),
  unsorted: navLabel('Unsorted', InboxOutlinedIcon, '/collection/unsorted')
}

export default navLabels;