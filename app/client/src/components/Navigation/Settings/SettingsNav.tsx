import { Box } from "@mui/material";
import SvgIcon, { SvgIconProps } from "@mui/material/SvgIcon";
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import GitHubIcon from '@mui/icons-material/GitHub';
import NavListItem from "../shared/NavListItem";
import SidebarHeader from "../shared/SidebarHeader";

// X (Twitter) Icon Component - same as in PrimaryNavigation
function XIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </SvgIcon>
  );
}

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
  { labelText: 'X', labelIcon: XIcon, linkTo: '/settings/x' },
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

