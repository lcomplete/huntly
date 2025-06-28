import * as React from "react";
import {SvgIconProps} from "@mui/material/SvgIcon";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import BookmarksOutlinedIcon from "@mui/icons-material/BookmarksOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import GitHubIcon from "@mui/icons-material/GitHub";
import BallotOutlinedIcon from "@mui/icons-material/BallotOutlined";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import TwitterIcon from '@mui/icons-material/Twitter';

export type NavLabel = {
  labelText: string,
  labelIcon: React.ElementType<SvgIconProps>,
  iconColor?: string,
  linkTo?: string,
  iconUrl?: string
}

export type NavLabels = {
  recently: NavLabel,
  myList: NavLabel,
  starred: NavLabel,
  readLater: NavLabel,
  archive: NavLabel,
  github: NavLabel,
  allFeeds: NavLabel,
  twitter: NavLabel,
  folder: NavLabel
}

export function navLabel(labelText: string, labelIcon: React.ElementType<SvgIconProps>, linkTo?: string, iconColor?: string): NavLabel {
  return {
    labelText,
    labelIcon,
    linkTo,
    iconColor
  };
}

const navLabels: NavLabels = {
  recently: navLabel('Recently Read', AccessTimeIcon, '/'),
  myList: navLabel('My List', FormatListBulletedIcon, '/list'),
  starred: navLabel('Starred', AutoAwesomeOutlinedIcon, '/starred'),
  readLater: navLabel('Read Later', BookmarksOutlinedIcon, '/later'),
  archive: navLabel('Archive', ArchiveOutlinedIcon, '/archive'),
  github: navLabel('GitHub', GitHubIcon),
  allFeeds: navLabel('All Feeds', BallotOutlinedIcon, '/feeds'),
  twitter: navLabel('Twitter', TwitterIcon, '/twitter', 'rgb(29, 155, 240)'),
  folder: navLabel('', FolderOpenIcon)
}

export default navLabels;