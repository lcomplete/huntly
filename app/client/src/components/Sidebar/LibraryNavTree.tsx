import { NavLink } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import navLabels, { NavLabel } from "./NavLabels";

const libraryItems: NavLabel[] = [
  navLabels.myList,
  navLabels.readLater,
  navLabels.starred,
  navLabels.archive,
  navLabels.highlights,
];

type LibraryNavTreeProps = {
  selectedNodeId: string;
  readLaterCount?: number;
};

export default function LibraryNavTree({ selectedNodeId, readLaterCount }: LibraryNavTreeProps) {
  return (
    <Box component="nav" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, pt: 0.5 }}>
      {libraryItems.map((item) => {
        const isSelected = selectedNodeId === item.linkTo;
        const isReadLater = item.linkTo === navLabels.readLater.linkTo;
        const showReadLaterCount = isReadLater && typeof readLaterCount === 'number';
        const IconComponent = item.labelIcon;

        return (
          <NavLink
            key={item.linkTo}
            to={item.linkTo || '/'}
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
                  color: isSelected ? '#3b82f6' : '#64748b',
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
              {showReadLaterCount && (
                <Box
                  sx={{
                    ml: 1,
                    color: isSelected ? '#475569' : '#64748b',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}
                >
                  {readLaterCount}
                </Box>
              )}
            </Box>
          </NavLink>
        );
      })}
    </Box>
  );
}
