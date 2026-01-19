import { Box } from "@mui/material";
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import GitHubIcon from '@mui/icons-material/GitHub';
import { SvgIconProps } from "@mui/material/SvgIcon";
import NavListItem from "../shared/NavListItem";
import SidebarHeader from "../shared/SidebarHeader";

interface SettingsNavItem {
  labelText: string;
  labelIcon: React.ElementType<SvgIconProps>;
  linkTo: string;
  useGradient?: boolean;
}

const settingsItems: SettingsNavItem[] = [
  { labelText: 'General', labelIcon: SettingsApplicationsIcon, linkTo: '/settings/general' },
  { labelText: 'Huntly AI', labelIcon: AutoAwesomeIcon, linkTo: '/settings/huntly-ai', useGradient: true },
  { labelText: 'Library', labelIcon: LibraryBooksIcon, linkTo: '/settings/library' },
  { labelText: 'Feeds', labelIcon: RssFeedIcon, linkTo: '/settings/feeds' },
  { labelText: 'GitHub', labelIcon: GitHubIcon, linkTo: '/settings/github' },
  { labelText: 'Account', labelIcon: AccountBoxIcon, linkTo: '/settings/account' },
];

interface SettingsNavProps {
  readonly selectedNodeId: string;
  readonly showHeader?: boolean;
}

export default function SettingsNav({ selectedNodeId, showHeader = false }: SettingsNavProps) {
  return (
    <>
      {showHeader && <SidebarHeader title="Settings" />}
      <Box component="nav" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, pt: 0.5 }}>
        {settingsItems.map((item) => (
          <NavListItem
            key={item.linkTo}
            to={item.linkTo}
            icon={item.labelIcon}
            label={item.labelText}
            isSelected={selectedNodeId === item.linkTo}
            useGradient={item.useGradient}
          />
        ))}
      </Box>
    </>
  );
}

export { settingsItems };

