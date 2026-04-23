import React, { useState } from "react";
import {
  Button,
  Menu,
  MenuItem,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Box,
} from "@mui/material";
import IosShareIcon from "@mui/icons-material/IosShare";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ImageIcon from "@mui/icons-material/Image";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CodeIcon from "@mui/icons-material/Code";
import ArticleIcon from "@mui/icons-material/Article";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useI18n } from "../i18n";

// Ensure portal-based menus render above the shadow DOM overlay.
const MENU_Z_INDEX = 2147483647;

import {
  exportAsPdf,
  exportAsImage,
  exportAsMarkdown,
  copyImageToClipboard,
  copyMarkdownToClipboard,
  ExportSource,
} from "../utils/exportUtils";

/** Type for content element reference - can be a React ref or a getter function */
export type ContentElementRef =
  | React.RefObject<HTMLElement>
  | (() => HTMLElement | null);

export interface ExportButtonProps {
  /** Reference to the original content element */
  originalContentRef: ContentElementRef;
  /** Reference to the AI processed content element (can be a ref or getter function) */
  aiContentRef: ContentElementRef;
  /** Original content as markdown */
  originalMarkdown: string;
  /** AI processed content as markdown */
  aiMarkdown: string;
  /** Whether AI content is available */
  hasAiContent: boolean;
  /** Page title for export filename */
  title?: string;
  /** Container element for Menu portal (Shadow DOM support) */
  menuContainer?: HTMLElement | (() => HTMLElement);
}

/** Helper to resolve content element from ref or function */
function resolveContentElement(ref: ContentElementRef): HTMLElement | null {
  if (typeof ref === "function") {
    return ref();
  }
  return ref.current;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  originalContentRef,
  aiContentRef,
  originalMarkdown,
  aiMarkdown,
  hasAiContent,
  title = "huntly-export",
  menuContainer,
}) => {
  const { t } = useI18n();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [exportSource, setExportSource] = useState<ExportSource>("original");
  const [isExporting, setIsExporting] = useState(false);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSourceChange = (
    _event: React.MouseEvent<HTMLElement>,
    newSource: ExportSource | null
  ) => {
    if (newSource !== null) {
      setExportSource(newSource);
    }
  };

  const getContentElement = (): HTMLElement | null => {
    if (exportSource === "ai" && hasAiContent) {
      return resolveContentElement(aiContentRef);
    }
    return resolveContentElement(originalContentRef);
  };

  const getMarkdown = (): string => {
    if (exportSource === "ai" && hasAiContent) {
      return aiMarkdown;
    }
    return originalMarkdown;
  };

  const sanitizeFilename = (name: string): string => {
    return name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_]/g, "_").substring(0, 100);
  };

  const handleExportPdf = async () => {
    const element = getContentElement();
    if (!element) return;
    
    setIsExporting(true);
    try {
      exportAsPdf(element, title);
    } catch (error) {
      console.error("Failed to export PDF:", error);
      alert(t("export.error.pdf"));
    } finally {
      setIsExporting(false);
      handleClose();
    }
  };

  const handleExportImage = async () => {
    const element = getContentElement();
    if (!element) return;
    
    setIsExporting(true);
    try {
      await exportAsImage(element, sanitizeFilename(title));
    } catch (error) {
      console.error("Failed to export image:", error);
      alert(t("export.error.image"));
    } finally {
      setIsExporting(false);
      handleClose();
    }
  };

  const handleCopyImage = async () => {
    const element = getContentElement();
    if (!element) return;
    
    setIsExporting(true);
    try {
      await copyImageToClipboard(element);
      handleClose();
    } catch (error) {
      console.error("Failed to copy image:", error);
      alert(t("export.error.copyImage"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyMarkdown = async () => {
    const markdown = getMarkdown();

    setIsExporting(true);
    try {
      await copyMarkdownToClipboard(markdown, title);
      handleClose();
    } catch (error) {
      console.error("Failed to copy markdown:", error);
      alert(t("export.error.copyMarkdown"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMarkdown = () => {
    const markdown = getMarkdown();

    setIsExporting(true);
    try {
      exportAsMarkdown(markdown, sanitizeFilename(title), title);
    } catch (error) {
      console.error("Failed to export markdown:", error);
      alert(t("export.error.markdown"));
    } finally {
      setIsExporting(false);
      handleClose();
    }
  };

  const getContainer = () => {
    if (typeof menuContainer === "function") {
      return menuContainer();
    }
    return menuContainer;
  };

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: "#fafafa",
        border: "1px solid rgba(0, 0, 0, 0.12)",
        borderRadius: "8px",
        padding: "2px",
        gap: "2px",
      }}
    >
      {/* Content source toggle - only show when AI content is available */}
      {hasAiContent && (
        <ToggleButtonGroup
          value={exportSource}
          exclusive
          onChange={handleSourceChange}
          size="small"
          sx={{
            "& .MuiToggleButtonGroup-grouped": {
              border: "none",
              borderRadius: "6px !important",
              margin: 0,
              "&:not(:last-of-type)": {
                marginRight: "2px",
              },
            },
            "& .MuiToggleButton-root": {
              textTransform: "none",
              fontSize: "12px",
              py: 0.25,
              px: 1,
              color: "#666",
              "&.Mui-selected": {
                backgroundColor: "#fff",
                color: "#1976d2",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                "&:hover": {
                  backgroundColor: "#fff",
                },
              },
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.04)",
              },
            },
          }}
        >
          <ToggleButton value="original">
            <ArticleIcon sx={{ fontSize: 14, mr: 0.5 }} />
            {t("export.original")}
          </ToggleButton>
          <ToggleButton value="ai">
            <AutoAwesomeIcon sx={{ fontSize: 14, mr: 0.5 }} />
            {t("export.ai")}
          </ToggleButton>
        </ToggleButtonGroup>
      )}

      {/* Export dropdown button */}
      <Button
        variant="text"
        size="small"
        startIcon={isExporting ? <CircularProgress size={14} /> : <IosShareIcon sx={{ fontSize: 16 }} />}
        endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 16 }} />}
        onClick={handleClick}
        disabled={isExporting}
        sx={{
          textTransform: "none",
          borderRadius: "6px",
          color: "#333",
          fontSize: "12px",
          fontWeight: 500,
          height: "28px",
          minWidth: "auto",
          px: 1,
          "&:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.04)",
          },
        }}
      >
        {t("export.button")}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        container={getContainer()}
        disableScrollLock
        sx={{ zIndex: MENU_Z_INDEX }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        PaperProps={{
          sx: {
            minWidth: 160,
            mt: 0.5,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            borderRadius: "8px",
            zIndex: MENU_Z_INDEX,
          },
        }}
      >
        <MenuItem onClick={handleExportPdf} disabled={isExporting} sx={{ py: 0.75, minHeight: "auto" }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <PictureAsPdfIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 13 }}>{t("export.asPdf")}</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleExportImage} disabled={isExporting} sx={{ py: 0.75, minHeight: "auto" }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <ImageIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 13 }}>{t("export.asImage")}</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleExportMarkdown} disabled={isExporting} sx={{ py: 0.75, minHeight: "auto" }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <CodeIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 13 }}>{t("export.asMarkdown")}</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleCopyImage} disabled={isExporting} sx={{ py: 0.75, minHeight: "auto" }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 13 }}>{t("export.copyImage")}</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleCopyMarkdown} disabled={isExporting} sx={{ py: 0.75, minHeight: "auto" }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <CodeIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 13 }}>{t("export.copyMarkdown")}</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ExportButton;

