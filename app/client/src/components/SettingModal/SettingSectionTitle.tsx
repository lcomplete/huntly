import React from "react";
import Typography from "@mui/material/Typography";

interface SettingSectionTitleProps {
  children: React.ReactNode;
  /** Whether this is the first section (no top margin) */
  first?: boolean;
  /** Optional description text below the title */
  description?: string;
}

/**
 * A unified section title component for settings pages.
 * Provides consistent styling across all settings sections.
 */
export default function SettingSectionTitle({ 
  children, 
  first = false,
  description 
}: SettingSectionTitleProps) {
  return (
    <div className={first ? "mb-4" : "mt-8 mb-4"}>
      <Typography 
        variant="subtitle1" 
        component="h3"
        className="font-semibold text-gray-700 pb-2 border-b border-gray-200"
      >
        {children}
      </Typography>
      {description && (
        <Typography 
          variant="body2" 
          className="mt-2 text-gray-500"
        >
          {description}
        </Typography>
      )}
    </div>
  );
}

