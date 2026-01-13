import { NavLink } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HubIcon from '@mui/icons-material/Hub';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LocalLibraryOutlinedIcon from '@mui/icons-material/LocalLibraryOutlined';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import TerminalIcon from '@mui/icons-material/Terminal';
import { SvgIconProps } from "@mui/material/SvgIcon";
import * as React from "react";

type SettingsNavItem = {
  labelText: string;
  labelIcon: React.ElementType<SvgIconProps>;
  linkTo: string;
  useGradient?: boolean;
};

const settingsItems: SettingsNavItem[] = [
  { labelText: 'General', labelIcon: SettingsApplicationsIcon, linkTo: '/settings/general' },
  { labelText: 'AI Shortcuts', labelIcon: AutoAwesomeIcon, linkTo: '/settings/ai-shortcuts', useGradient: true },
  { labelText: 'MCP Service', labelIcon: TerminalIcon, linkTo: '/settings/mcp' },
  { labelText: 'Connect', labelIcon: HubIcon, linkTo: '/settings/connect' },
  { labelText: 'Feeds', labelIcon: RssFeedIcon, linkTo: '/settings/feeds' },
  { labelText: 'Folders', labelIcon: FolderOpenIcon, linkTo: '/settings/folders' },
  // { labelText: 'Library', labelIcon: LocalLibraryOutlinedIcon, linkTo: '/settings/library' },
  { labelText: 'Account', labelIcon: AccountBoxIcon, linkTo: '/settings/account' },
];

type SettingsNavTreeProps = {
  selectedNodeId: string;
};

export default function SettingsNavTree({ selectedNodeId }: SettingsNavTreeProps) {
  return (
    <Box component="nav" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, pt: 0.5 }}>
      {settingsItems.map((item) => {
        const isSelected = selectedNodeId === item.linkTo;
        const IconComponent = item.labelIcon;

        // For gradient icon, use CSS background-clip technique
        const iconColor = item.useGradient
          ? '#a78bfa' // Fallback purple color for AI icon
          : (isSelected ? '#3b82f6' : '#64748b');

        return (
          <NavLink
            key={item.linkTo}
            to={item.linkTo}
            style={{ textDecoration: 'none' }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 1.25,
                py: 0.875,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                bgcolor: isSelected ? 'rgba(59, 130, 246, 0.10)' : 'transparent',
                '&:hover': {
                  bgcolor: isSelected ? 'rgba(59, 130, 246, 0.10)' : 'rgba(59, 130, 246, 0.05)',
                },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1,
                  color: iconColor,
                  transition: 'color 0.15s ease',
                  '& .MuiSvgIcon-root': {
                    fontSize: 20,
                  },
                }}
              >
                <IconComponent />
              </Box>
              <Typography
                sx={{
                  fontSize: '14px',
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? '#2563eb' : '#475569',
                  lineHeight: 1.4,
                  transition: 'color 0.15s ease',
                  flexGrow: 1,
                }}
              >
                {item.labelText}
              </Typography>
            </Box>
          </NavLink>
        );
      })}
    </Box>
  );
}

export { settingsItems };

