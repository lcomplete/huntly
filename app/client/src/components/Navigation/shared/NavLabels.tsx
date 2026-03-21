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
import i18n from '../../../i18n';

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
  showLabel?: boolean,
  i18nKey?: string
}

export type NavLabelKey = 'home' | 'recently' | 'myList' | 'starred' | 'readLater' | 'archive' | 'github' | 'allFeeds' | 'twitter' | 'highlights' | 'folder' | 'search' | 'unsorted';

export type NavLabels = Record<NavLabelKey, NavLabel>;

export function navLabel(labelText: string, labelIcon: React.ElementType<SvgIconProps>, linkTo?: string, iconColor?: string, showLabel: boolean = true, i18nKey?: string): NavLabel {
  return {
    labelText,
    labelIcon,
    linkTo,
    iconColor,
    showLabel,
    i18nKey
  };
}

export function getTranslatedLabel(label: NavLabel): string {
  if (label.i18nKey) {
    return i18n.t(label.i18nKey, { ns: 'navigation' });
  }
  return label.labelText;
}

const navLabels: NavLabels = {
  home: navLabel('Home', HomeOutlinedIcon, '/', undefined, true, 'home'),
  recently: navLabel('Recently Read', AccessTimeIcon, '/recently-read', undefined, true, 'recentlyRead'),
  myList: navLabel('My List', FormatListBulletedIcon, '/list', undefined, true, 'myList'),
  starred: navLabel('Starred', AutoAwesomeOutlinedIcon, '/starred', undefined, true, 'starred'),
  readLater: navLabel('Read Later', BookmarksOutlinedIcon, '/later', undefined, true, 'readLater'),
  archive: navLabel('Archive', ArchiveOutlinedIcon, '/archive', undefined, true, 'archive'),
  github: navLabel('GitHub', GitHubIcon, undefined, undefined, true, 'github'),
  allFeeds: navLabel('All Feeds', BallotOutlinedIcon, '/feeds', undefined, true, 'allFeeds'),
  twitter: navLabel('X', XIcon, '/twitter', undefined, false, 'x'),
  highlights: navLabel('Highlights', FormatQuoteIcon, '/highlights', undefined, true, 'highlights'),
  folder: navLabel('', FolderOpenIcon),
  search: navLabel('Search', SearchIcon, '/search', undefined, true, 'search'),
  unsorted: navLabel('Unsorted', InboxOutlinedIcon, '/collection/unsorted', undefined, true, 'unsorted')
}

export default navLabels;