import React from 'react';
import { Link } from 'react-router-dom';
import { IconButton } from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

interface SidebarHeaderProps {
  title: string;
  actionLink?: string;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ title, actionLink }) => {
  return (
    <div className="secondary-sidebar-header flex items-center">
      <div
        style={{
          flex: 1,
          fontSize: '14px',
          fontWeight: 600,
          color: '#334155',
          letterSpacing: '0.01em',
        }}
      >
        {title}
      </div>
      {actionLink && (
        <Link to={actionLink}>
          <IconButton
            size="small"
            sx={{
              width: 24,
              height: 24,
              bgcolor: 'transparent',
              borderRadius: '5px',
              transition: 'color 0.15s ease',
              color: '#94a3b8',
              '&:hover': {
                color: '#64748b',
              },
            }}
          >
            <SettingsOutlinedIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Link>
      )}
    </div>
  );
};

export default SidebarHeader;

