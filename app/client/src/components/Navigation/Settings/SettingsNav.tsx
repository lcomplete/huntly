import { Box } from "@mui/material";
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HubIcon from '@mui/icons-material/Hub';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import TerminalIcon from '@mui/icons-material/Terminal';
import LocalLibraryOutlinedIcon from '@mui/icons-material/LocalLibraryOutlined';
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
  { labelText: 'AI Shortcuts', labelIcon: AutoAwesomeIcon, linkTo: '/settings/ai-shortcuts', useGradient: true },
  { labelText: 'MCP Server', labelIcon: TerminalIcon, linkTo: '/settings/mcp' },
  { labelText: 'Connect', labelIcon: HubIcon, linkTo: '/settings/connect' },
  { labelText: 'Feeds', labelIcon: RssFeedIcon, linkTo: '/settings/feeds' },
  { labelText: 'Feed Folders', labelIcon: FolderOpenIcon, linkTo: '/settings/folders' },
  { labelText: 'Library Export', labelIcon: LocalLibraryOutlinedIcon, linkTo: '/settings/library' },
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

