import React from "react";
import Typography from "@mui/material/Typography";
import { SvgIconProps } from "@mui/material/SvgIcon";

interface SettingSectionTitleProps {
  children: React.ReactNode;
  /** Whether this is the first section (no top margin) */
  first?: boolean;
  /** Optional description text below the title */
  description?: string;
  /** Optional icon component */
  icon?: React.ElementType<SvgIconProps>;
}

/**
 * A unified section title component for settings pages.
 * Provides consistent styling across all settings sections.
 */
export default function SettingSectionTitle({
  children,
  first = false,
  description,
  icon: IconComponent
}: SettingSectionTitleProps) {
  return (
    <div className={`${first ? "mb-2" : "mt-8 mb-2"}`}>
      <div className="flex items-center gap-3 pb-3 border-b-2 border-transparent"
        style={{ borderImage: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, transparent 100%) 1' }}>
        {IconComponent && (
          <div className="flex items-center justify-center w-9 h-9 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)' }}>
            <IconComponent sx={{ fontSize: 20, color: '#fff' }} />
          </div>
        )}
        <div className="flex-1">
          <Typography
            variant="h6"
            component="h3"
            sx={{
              fontWeight: 600,
              color: '#1e293b',
              fontSize: '1.0625rem',
              letterSpacing: '-0.01em',
              lineHeight: 1.4
            }}
          >
            {children}
          </Typography>
        </div>
      </div>
      {description && (
        <Typography
          variant="body2"
          sx={{
            mt: 1.5,
            color: '#64748b',
            fontSize: '0.875rem',
            lineHeight: 1.6
          }}
        >
          {description}
        </Typography>
      )}
    </div>
  );
}

