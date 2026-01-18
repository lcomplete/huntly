import React, { useState } from "react";
import { Box, Tab, Tabs } from "@mui/material";
import ArticleShortcutSetting from "./ArticleShortcutSetting";
import McpSetting from "./McpSetting";
import BoltIcon from '@mui/icons-material/Bolt';
import HubIcon from '@mui/icons-material/Hub';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`huntly-ai-tabpanel-${index}`}
      aria-labelledby={`huntly-ai-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `huntly-ai-tab-${index}`,
    'aria-controls': `huntly-ai-tabpanel-${index}`,
  };
}

export default function HuntlyAISetting() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <div>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="huntly ai settings tabs">
          <Tab icon={<BoltIcon />} iconPosition="start" label="AI Shortcuts" {...a11yProps(0)} sx={{ minHeight: 48 }} />
          <Tab icon={<HubIcon />} iconPosition="start" label="MCP Server" {...a11yProps(1)} sx={{ minHeight: 48 }} />
        </Tabs>
      </Box>
      <TabPanel value={tabValue} index={0}>
        <ArticleShortcutSetting />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <McpSetting />
      </TabPanel>
    </div>
  );
}
