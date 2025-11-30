import React, {useEffect} from "react";
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Modal
} from "@mui/material";
import RssFeedIcon from "@mui/icons-material/RssFeed";
import HubIcon from '@mui/icons-material/Hub';
import {ConnectorSetting} from "./ConnectorSetting";
import {FeedsSetting} from "./FeedsSetting";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FoldersSetting from "./FoldersSetting";
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import AccountSetting from "./AccountSetting";
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications';
import GeneralSetting from "./GeneralSetting";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArticleShortcutSetting from "./ArticleShortcutSetting";

type SettingModalProps = {
  open: boolean,
  defaultIndex?: number,
  onClose: () => void,
}

export default function SettingModal(props: SettingModalProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(props.defaultIndex || 0);

  const handleListItemClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    index: number,
  ) => {
    setSelectedIndex(index);
  };

  const style = {
    width: 1000,
    height: 660,
    overflow: 'auto',
    bgcolor: 'background.paper',
    boxShadow: 24,
  };

  return (
    <Modal open={props.open} onClose={props.onClose} className={'flex justify-center items-center'}>
      <Box className={'flex scrollbar'} sx={style}>
        <svg width={0} height={0} style={{ position: 'absolute', visibility: 'hidden' }}>
          <linearGradient id="geminiGradientSettings" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4facfe" />
            <stop offset="50%" stopColor="#a18cd1" />
            <stop offset="100%" stopColor="#fbc2eb" />
          </linearGradient>
        </svg>
        <div className={'w-[220px] h-full bg-[rgb(251,251,250)] sticky self-start top-0 left-0 shrink-0'}>
          <List component="nav" aria-label="setting items" className={''}>
            <ListItemButton
              selected={selectedIndex === 0}
              onClick={(event) => handleListItemClick(event, 0)}
            >
              <ListItemIcon>
                <SettingsApplicationsIcon/>
              </ListItemIcon>
              <ListItemText primary="General"/>
            </ListItemButton>
            <ListItemButton
              selected={selectedIndex === 1}
              onClick={(event) => handleListItemClick(event, 1)}
            >
              <ListItemIcon>
                <AutoAwesomeIcon sx={{ fill: "url(#geminiGradientSettings)" }} />
              </ListItemIcon>
              <ListItemText primary="AI Shortcuts"/>
            </ListItemButton>
            <ListItemButton
              selected={selectedIndex === 2}
              onClick={(event) => handleListItemClick(event, 2)}
            >
              <ListItemIcon>
                <HubIcon/>
              </ListItemIcon>
              <ListItemText primary="Connect"/>
            </ListItemButton>
            <ListItemButton
              selected={selectedIndex === 3}
              onClick={(event) => handleListItemClick(event, 3)}
            >
              <ListItemIcon>
                <RssFeedIcon/>
              </ListItemIcon>
              <ListItemText primary="Feeds"/>
            </ListItemButton>
            <ListItemButton
              selected={selectedIndex === 4}
              onClick={(event) => handleListItemClick(event, 4)}
            >
              <ListItemIcon>
                <FolderOpenIcon/>
              </ListItemIcon>
              <ListItemText primary="Folders"/>
            </ListItemButton>
            <ListItemButton
              selected={selectedIndex === 5}
              onClick={(event) => handleListItemClick(event, 5)}
            >
              <ListItemIcon>
                <AccountBoxIcon/>
              </ListItemIcon>
              <ListItemText primary="Account"/>
            </ListItemButton>
          </List>
        </div>

        <div className={'grow'}>
          <div className={'p-4'}>
            {
              selectedIndex === 0 && <GeneralSetting/>
            }
            {
              selectedIndex === 1 && <ArticleShortcutSetting/>
            }
            {
              selectedIndex === 2 && <ConnectorSetting/>
            }
            {
              selectedIndex === 3 && <FeedsSetting/>
            }
            {
              selectedIndex === 4 && <FoldersSetting/>
            }
            {
              selectedIndex === 5 && <AccountSetting/>
            }
          </div>
        </div>
      </Box>
    </Modal>
  )
}