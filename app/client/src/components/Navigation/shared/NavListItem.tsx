import React from 'react';
import { NavLink } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { SvgIconProps } from '@mui/material/SvgIcon';

export interface NavListItemProps {
  to: string;
  icon: React.ElementType<SvgIconProps>;
  label: string;
  isSelected: boolean;
  count?: number;
  useGradient?: boolean;
}

// Shared styles for nav items
const navItemStyles = {
  container: (isSelected: boolean) => ({
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
  }),
  iconWrapper: (color: string) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    mr: 1,
    color,
    transition: 'color 0.15s ease',
    '& .MuiSvgIcon-root': {
      fontSize: 20,
    },
  }),
  label: (isSelected: boolean) => ({
    fontSize: '14px',
    fontWeight: isSelected ? 600 : 500,
    color: isSelected ? '#2563eb' : '#475569',
    lineHeight: 1.4,
    transition: 'color 0.15s ease',
    flexGrow: 1,
  }),
  count: (isSelected: boolean) => ({
    ml: 1,
    color: isSelected ? '#475569' : '#64748b',
    fontSize: '11.5px',
    fontWeight: 600,
    lineHeight: 1.4,
  }),
};

const NavListItem: React.FC<NavListItemProps> = ({
  to,
  icon: IconComponent,
  label,
  isSelected,
  count,
  useGradient,
}) => {
  const iconColor = useGradient
    ? '#a78bfa' // Fallback purple for gradient icons
    : isSelected
    ? '#3b82f6'
    : '#64748b';

  return (
    <NavLink to={to} style={{ textDecoration: 'none' }}>
      <Box sx={navItemStyles.container(isSelected)}>
        <Box sx={navItemStyles.iconWrapper(iconColor)}>
          <IconComponent />
        </Box>
        <Typography sx={navItemStyles.label(isSelected)}>{label}</Typography>
        {typeof count === 'number' && (
          <Box sx={navItemStyles.count(isSelected)}>{count}</Box>
        )}
      </Box>
    </NavLink>
  );
};

export default NavListItem;

