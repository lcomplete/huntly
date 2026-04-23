import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputBase,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Snackbar,
  Tooltip,
  Typography,
} from "@mui/material";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import StarIcon from "@mui/icons-material/Star";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import ArchiveIcon from "@mui/icons-material/Archive";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlaylistRemoveIcon from "@mui/icons-material/PlaylistRemove";
import FolderOffOutlinedIcon from "@mui/icons-material/FolderOffOutlined";
import { PageOperateResult } from "../model/pageOperateResult";
import { LibrarySaveStatus } from "../model/librarySaveStatus";
import {
  updatePageDetail,
  readLaterPage,
  unReadLaterPage,
  starPage,
  unStarPage,
  archivePage,
  savePageToLibrary,
  removePageFromLibrary,
  getCollectionTree,
  getPageDetail,

  updatePageCollection,
} from "../services";
import { ContentParserType, readSyncStorageSettings } from "../storage";
import { parseDocument } from "../parser/contentParser";
import { useShadowContainer } from "./shadowContainerContext";
import type { SxProps, Theme } from "@mui/material/styles";
import { useI18n } from "../i18n";

// Shared style constants
const FORM_ROW_SX: SxProps<Theme> = {
  display: "flex",
  alignItems: "center",
  py: 1.2,
  borderBottom: "1px solid rgba(0,0,0,0.06)",
};

const FORM_LABEL_SX: SxProps<Theme> = {
  width: 68,
  flexShrink: 0,
  fontSize: "0.82rem",
  color: "text.secondary",
  textAlign: "right",
  pr: 1.5,
};

const SELECT_SX: SxProps<Theme> = {
  borderRadius: "8px",
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(0,0,0,0.12)",
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(0,0,0,0.25)",
  },
};


// Helper component for form rows
const FormRow: React.FC<{
  label: string;
  children: React.ReactNode;
  alignItems?: "center" | "flex-start";
  labelPt?: number;
  sx?: SxProps<Theme>;
}> = ({ label, children, alignItems = "center", labelPt, sx }) => (
  <Box sx={{ ...FORM_ROW_SX, alignItems, ...sx }}>
    <Typography sx={{ ...FORM_LABEL_SX, ...(labelPt !== undefined && { pt: labelPt }) }}>
      {label}
    </Typography>
    {children}
  </Box>
);

interface SaveDetailPanelProps {
  pageId: number;
  page: PageModel;
  operateResult: PageOperateResult;
  initialParserType?: ContentParserType;
  faviconUrl?: string;
  /** Collection tree data (for content script use to avoid CORS issues) */
  collectionTree?: any;
  onClose?: () => void;
  onDeleted?: () => void;
  onOperateResultChanged?: (result: PageOperateResult) => void;
}

// Flatten collection tree into select options
interface CollectionOption {
  id: number | null;
  name: string;
  isGroup?: boolean;
  depth?: number;
}

interface DbPageState {
  id?: number;
  title?: string;
  description?: string;
  url?: string;
  collectionId?: number | null;
  savedAt?: string;
  createdAt?: string;
  librarySaveStatus?: number;
  starred?: boolean;
  readLater?: boolean;
}

function flattenTree(tree: any): CollectionOption[] {
  if (!tree) return [];
  const options: CollectionOption[] = [];
  if (tree.groups) {
    for (const group of tree.groups) {
      options.push({ id: null, name: group.name, isGroup: true, depth: 0 });
      if (group.collections) {
        const flatten = (collections: any[], depth: number) => {
          for (const col of collections) {
            options.push({ id: col.id, name: col.name, depth });
            if (col.children && col.children.length > 0) {
              flatten(col.children, depth + 1);
            }
          }
        };
        flatten(group.collections, 1);
      }
    }
  }
  return options;
}

// Inline editable text that looks like plain text, shows underline on focus
const InlineEdit: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  placeholder?: string;
  fontWeight?: number;
  fontSize?: string;
  maxLines?: number;
  color?: string;
}> = ({ value, onChange, onSave, placeholder, fontWeight = 400, fontSize = "0.88rem", maxLines = 3, color }) => (
  <InputBase
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onBlur={onSave}
    placeholder={placeholder}
    fullWidth
    multiline
    maxRows={maxLines}
    sx={{
      fontSize,
      fontWeight,
      color: color || "text.primary",
      lineHeight: 1.5,
      px: 0,
      py: 0.3,
      borderRadius: 0,
      borderBottom: "1.5px solid transparent",
      backgroundColor: "transparent",
      transition: "border-color 0.2s ease",
      cursor: "text",
      "&:hover": {
        borderBottomColor: "rgba(0,0,0,0.2)",
      },
      "&:focus-within": {
        borderBottomColor: "#1976d2",
        "& .MuiInputBase-input": {
          display: "block",
          WebkitLineClamp: "unset",
          overflow: "visible",
        },
      },
      "& .MuiInputBase-input": {
        padding: 0,
        "&::placeholder": {
          color: "rgba(0,0,0,0.35)",
          opacity: 1,
        },
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": {
          display: "none",
        },
        ...(maxLines ? {
          display: "-webkit-box",
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        } : {}),
      },
    }}
  />
);

const SaveDetailPanel: React.FC<SaveDetailPanelProps> = ({
  pageId,
  page,
  operateResult,
  initialParserType,
  faviconUrl,
  collectionTree,
  onClose,
  onDeleted,
  onOperateResultChanged,
}) => {
  const { language, t } = useI18n();
  const menuContainer = useShadowContainer();
  const [title, setTitle] = useState(page.title || "");
  const [description, setDescription] = useState(page.description || "");
  const [url] = useState(page.url || "");
  const [loadingDbState, setLoadingDbState] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<PageOperateResult>(operateResult);

  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [selectedParser, setSelectedParser] = useState<ContentParserType>(initialParserType || "readability");
  const [resavingDetail, setResavingDetail] = useState(false);

  // Collections
  const [collectionOptions, setCollectionOptions] = useState<CollectionOption[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);


  const originalTitle = useRef(page.title || "");
  const originalDesc = useRef(page.description || "");
  const parserOptions = useMemo(
    () => [
      {
        value: "readability" as const,
        label: t("general.contentParser.readability.title"),
      },
      {
        value: "defuddle" as const,
        label: t("general.contentParser.defuddle.title"),
      },
    ],
    [t]
  );

  useEffect(() => {
    setCurrentResult(operateResult);
  }, [operateResult]);

  const showError = useCallback((message: string, error?: unknown) => {
    if (error) {
      console.error(message, error);
    }
    setSaveSuccess(null);
    setSaveError(message);
  }, []);

  const applyDbPageState = useCallback((dbPage: DbPageState) => {
    const nextTitle = dbPage.title || "";
    const nextDescription = dbPage.description || "";

    const nextCollectionId = dbPage.collectionId ?? null;
    const savedDate = dbPage.savedAt || dbPage.createdAt;
    const parsedSavedAt = savedDate ? new Date(savedDate) : null;

    setTitle(nextTitle);
    setDescription(nextDescription);
    setSelectedCollectionId(nextCollectionId);
    setSavedAt(parsedSavedAt && !Number.isNaN(parsedSavedAt.getTime()) ? parsedSavedAt : null);
    originalTitle.current = nextTitle;
    originalDesc.current = nextDescription;

    const resultFromDb: PageOperateResult = {
      id: dbPage.id || pageId,
      librarySaveStatus: dbPage.librarySaveStatus ?? operateResult?.librarySaveStatus,
      starred: dbPage.starred ?? operateResult?.starred,
      readLater: dbPage.readLater ?? operateResult?.readLater,
    };
    setCurrentResult(resultFromDb);
    onOperateResultChanged?.(resultFromDb);
  }, [onOperateResultChanged, operateResult?.librarySaveStatus, operateResult?.readLater, operateResult?.starred, pageId]);

  useEffect(() => {
    if (initialParserType) {
      setSelectedParser(initialParserType);
      return;
    }
    readSyncStorageSettings().then((settings) => {
      if (settings?.contentParser) {
        setSelectedParser(settings.contentParser);
      }
    }).catch(() => { });
  }, [initialParserType]);

  useEffect(() => {
    let canceled = false;
    const loadPageState = async () => {
      setLoadingDbState(true);
      try {
        const detail = await getPageDetail(pageId);
        const dbPage = detail?.page as DbPageState;
        if (!canceled && dbPage) {
          applyDbPageState(dbPage);
        }
      } catch (error) {
        if (!canceled) {
          showError(t("saveDetail.error.loadDetails"), error);
        }
      } finally {
        if (!canceled) {
          setLoadingDbState(false);
        }
      }
    };
    loadPageState();
    return () => {
      canceled = true;
    };
  }, [pageId, t]);

  useEffect(() => {
    if (!saveError && !saveSuccess) return;
    const timer = setTimeout(() => {
      setSaveError(null);
      setSaveSuccess(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [saveError, saveSuccess]);

  // Load collections - use provided data if available (for shadow DOM/content script context)
  useEffect(() => {
    if (collectionTree) {
      // Use collection tree passed from parent (already fetched via background script)
      setCollectionOptions(flattenTree(collectionTree));
    } else {
      // Fetch directly (popup context where CORS is not an issue)
      getCollectionTree().then((tree) => {
        if (tree) {
          setCollectionOptions(flattenTree(tree));
        }
      }).catch((error) => {
        showError(t("saveDetail.error.loadCollections"), error);
      });
    }
  }, [collectionTree, showError, t]);

  const updateResult = useCallback(
    (result: PageOperateResult) => {
      if (result) {
        setCurrentResult(result);
        onOperateResultChanged?.(result);
      }
    },
    [onOperateResultChanged]
  );

  const handleTitleSave = useCallback(async () => {
    if (title !== originalTitle.current) {
      try {
        setSaveError(null);
        const result = await updatePageDetail(pageId, { title });
        updateResult(result);
        originalTitle.current = title;
      } catch (error) {
        showError(t("saveDetail.error.saveTitle"), error);
      }
    }
  }, [title, pageId, showError, t, updateResult]);

  const handleDescriptionSave = useCallback(async () => {
    if (description !== originalDesc.current) {
      try {
        setSaveError(null);
        const result = await updatePageDetail(pageId, { description });
        updateResult(result);
        originalDesc.current = description;
      } catch (error) {
        showError(t("saveDetail.error.saveDescription"), error);
      }
    }
  }, [description, pageId, showError, t, updateResult]);


  const handleCollectionChange = useCallback(async (collectionId: number | null) => {
    const previousCollectionId = selectedCollectionId;
    setSelectedCollectionId(collectionId);
    try {
      setSaveError(null);
      await updatePageCollection(pageId, collectionId);
    } catch (error) {
      setSelectedCollectionId(previousCollectionId);
      showError(t("saveDetail.error.saveCollection"), error);
    }
  }, [pageId, selectedCollectionId, showError, t]);

  const handleReadLater = useCallback(async () => {
    try {
      setSaveError(null);
      const result = currentResult?.readLater
        ? await unReadLaterPage(pageId)
        : await readLaterPage(pageId);
      updateResult(result);
    } catch (error) {
      showError(t("saveDetail.error.updateReadLater"), error);
    }
  }, [currentResult?.readLater, pageId, showError, t, updateResult]);

  const handleStar = useCallback(async () => {
    try {
      setSaveError(null);
      const result = currentResult?.starred
        ? await unStarPage(pageId)
        : await starPage(pageId);
      updateResult(result);
    } catch (error) {
      showError(t("saveDetail.error.updateStar"), error);
    }
  }, [currentResult?.starred, pageId, showError, t, updateResult]);

  const handleArchive = useCallback(async () => {
    try {
      setSaveError(null);
      if (currentResult?.librarySaveStatus === LibrarySaveStatus.Archived) {
        const result = await savePageToLibrary(pageId);
        updateResult(result);
      } else {
        const result = await archivePage(pageId);
        updateResult(result);
      }
    } catch (error) {
      showError(t("saveDetail.error.updateArchive"), error);
    }
  }, [currentResult?.librarySaveStatus, pageId, showError, t, updateResult]);

  const handleRemoveFromLibrary = useCallback(async () => {
    try {
      setSaveError(null);
      const result = await removePageFromLibrary(pageId);
      updateResult(result);
      onDeleted?.();
    } catch (error) {
      showError(t("saveDetail.error.removeFromList"), error);
    }
  }, [onDeleted, pageId, showError, t, updateResult]);

  const parsePageWithParser = useCallback((parserType: ContentParserType): Promise<PageModel> => {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.id) {
          reject(new Error(t("saveDetail.error.noActiveTab")));
          return;
        }
        chrome.tabs.sendMessage(tab.id, {
          type: "parse_doc",
          payload: { parserType },
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response?.page) {
            reject(new Error(t("saveDetail.error.invalidPage")));
            return;
          }
          resolve(response.page as PageModel);
        });
      });
    });
  }, [t]);

  const handleResaveDetails = useCallback(async () => {
    setResavingDetail(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      // Try parsing via content script message (works in popup context);
      // on failure (e.g. reading mode where chrome.tabs is unavailable),
      // fall back to parsing the DOM directly with the selected parser.
      let parsedPage: PageModel;
      try {
        parsedPage = await parsePageWithParser(selectedParser);
      } catch {
        // Direct DOM parsing fallback for content script / reading mode
        const doc = document.cloneNode(true) as Document;
        const article = parseDocument(doc, selectedParser);
        if (article) {
          parsedPage = {
            ...page,
            title: article.title || page.title,
            content: article.content,
            description: article.excerpt || page.description,
          };
        } else {
          // Last resort: use existing page data
          parsedPage = page;
        }
      }
      const result = await updatePageDetail(pageId, {
        content: parsedPage.content || undefined,
      });
      updateResult(result);
      // Reload full state from DB
      const detail = await getPageDetail(pageId);
      const dbPage = detail?.page as DbPageState;
      if (dbPage) {
        applyDbPageState(dbPage);
      }
      setSaveSuccess(t("saveDetail.success.resave"));
    } catch (error) {
      showError(t("saveDetail.error.resave"), error);
    } finally {
      setResavingDetail(false);
    }
  }, [applyDbPageState, page, pageId, parsePageWithParser, selectedParser, showError, t, updateResult]);

  const resolvedFavicon =
    faviconUrl || `https://www.google.com/s2/favicons?domain=${page.domain}&sz=32`;

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header: back button + favicon + inline-editable title & description — sticky */}
      <Box sx={{
        display: "flex",
        alignItems: "flex-start",
        px: 1.5,
        pt: 1,
        pb: 1.5,
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        flexShrink: 0,
      }}>
        {onClose && (
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              mr: 0.5,
              mt: 0.5,
              transition: "all 0.15s ease",
              "&:hover": {
                backgroundColor: "rgba(0,0,0,0.06)",
              },
            }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        )}
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: "12px",
            marginRight: 1.5,
            marginTop: 0.5,
            flexShrink: 0,
            backgroundColor: "#f5f5f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <img
            src={resolvedFavicon}
            alt=""
            style={{
              width: 40,
              height: 40,
              objectFit: "contain",
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, pt: 0.5 }}>
          <InlineEdit
            value={title}
            onChange={setTitle}
            onSave={handleTitleSave}
            placeholder={t("saveDetail.titlePlaceholder")}
            fontWeight={600}
            fontSize="0.95rem"
            maxLines={3}
          />
          <Box sx={{ mt: 0.5 }}>
            <InlineEdit
              value={description}
              onChange={setDescription}
              onSave={handleDescriptionSave}
              placeholder={t("saveDetail.descriptionPlaceholder")}
              fontSize="0.82rem"
              color="rgba(0,0,0,0.55)"
              maxLines={2}
            />
          </Box>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 0.5,
              fontSize: "0.75rem",
              color: "text.disabled",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              width: "100%",
            }}
            title={url}
          >
            {url}
          </Typography>
        </Box>
      </Box>

      {/* Scrollable content area */}
      <Box sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        px: 1.5,
        pb: 2.5, // 增加底部内边距，确保最底下元素显示完整
        "&::-webkit-scrollbar": {
          width: 6,
        },
        "&::-webkit-scrollbar-track": {
          background: "transparent",
        },
        "&::-webkit-scrollbar-thumb": {
          background: "rgba(0,0,0,0.15)",
          borderRadius: 3,
        },
        "&::-webkit-scrollbar-thumb:hover": {
          background: "rgba(0,0,0,0.25)",
        },
        scrollbarWidth: "none",
        scrollbarColor: "rgba(0,0,0,0.15) transparent",
      }}>
        {loadingDbState && (
          <Box sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: 1.5,
            py: 1,
            px: 1.5,
            backgroundColor: "rgba(25, 118, 210, 0.04)",
            borderRadius: "8px",
          }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              {t("saveDetail.loading")}
            </Typography>
          </Box>
        )}
        {saveError && (
          <Alert
            severity="error"
            sx={{
              mb: 1.5,
              py: 0.5,
              borderRadius: "8px",
              "& .MuiAlert-message": { fontSize: "0.82rem" },
            }}
          >
            {saveError}
          </Alert>
        )}
        <Snackbar
          open={!!saveSuccess}
          autoHideDuration={3000}
          onClose={() => setSaveSuccess(null)}
          message={saveSuccess}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          sx={{ zIndex: 9999999 }}
        />

        {/* Collection */}
        <FormRow label={t("saveDetail.collection")}>
          <FormControl size="small" sx={{ flex: 1, minWidth: 180 }}>
            <InputLabel>{t("saveDetail.collection")}</InputLabel>
            <Select
              value={selectedCollectionId ?? "unsorted"}
              label={t("saveDetail.collection")}
              onChange={(e) => {
                const val = e.target.value;
                handleCollectionChange(val === "unsorted" ? null : Number(val));
              }}
              sx={SELECT_SX}
              renderValue={(selected) => {
                if (selected === "unsorted") {
                  return (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <FolderOffOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                      <span>{t("saveDetail.unsorted")}</span>
                    </Box>
                  );
                }
                const col = collectionOptions.find((c) => c.id === selected);
                return col?.name || "";
              }}
              MenuProps={{
                container: menuContainer || undefined,
                disableScrollLock: true,
                sx: { zIndex: 9999999 },
                PaperProps: {
                  sx: {
                    borderRadius: "10px",
                    mt: 0.5,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                  },
                },
              }}
            >
              {[
                <MenuItem
                  key="unsorted"
                  value="unsorted"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    py: 1,
                    borderRadius: "6px",
                    mx: 0.5,
                    "&:hover": {
                      backgroundColor: "rgba(0,0,0,0.04)",
                    },
                  }}
                >
                  <FolderOffOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                  {t("saveDetail.unsorted")}
                </MenuItem>,
                ...collectionOptions.map((opt, idx) =>
                  opt.isGroup ? (
                    <ListSubheader
                      key={`g-${idx}`}
                      sx={{
                        lineHeight: "32px",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        color: "text.secondary",
                        backgroundColor: "transparent",
                      }}
                    >
                      {opt.name}
                    </ListSubheader>
                  ) : (
                    <MenuItem
                      key={`c-${opt.id}`}
                      value={opt.id!}
                      sx={{
                        pl: 2 + (opt.depth || 0) * 2,
                        borderRadius: "6px",
                        mx: 0.5,
                        "&:hover": {
                          backgroundColor: "rgba(0,0,0,0.04)",
                        },
                      }}
                    >
                      {opt.name}
                    </MenuItem>
                  )
                ),
              ]}
            </Select>
          </FormControl>
        </FormRow>

        {page.contentType !== 4 && (
          <FormRow label={t("saveDetail.content")}>
            <Box sx={{ flex: 1, display: "flex", gap: 1.2, alignItems: "center", flexWrap: "wrap" }}>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel id="save-detail-parser-label">{t("saveDetail.parser")}</InputLabel>
                <Select
                  labelId="save-detail-parser-label"
                  value={selectedParser}
                  label={t("saveDetail.parser")}
                  onChange={(e) => setSelectedParser(e.target.value as ContentParserType)}
                  MenuProps={{
                    container: menuContainer || undefined,
                    disableScrollLock: true,
                    sx: { zIndex: 9999999 },
                  }}
                  sx={SELECT_SX}
                >
                  {parserOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  )) as React.ReactNode[]}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                size="small"
                onClick={handleResaveDetails}
                disabled={resavingDetail || loadingDbState}
                sx={{
                  textTransform: "none",
                  minWidth: 120,
                  borderRadius: "8px",
                  borderColor: "rgba(0,0,0,0.15)",
                  color: "text.primary",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    borderColor: "primary.main",
                    backgroundColor: "rgba(25, 118, 210, 0.04)",
                  },
                  "&:disabled": {
                    borderColor: "rgba(0,0,0,0.08)",
                  },
                }}
              >
                {resavingDetail ? <CircularProgress size={16} color="inherit" /> : t("saveDetail.resave")}
              </Button>
            </Box>
          </FormRow>
        )}

        {/* Action buttons row */}
        <FormRow label={t("saveDetail.actions")} sx={{ gap: 0, py: 1.5 }}>
          <Tooltip title={currentResult?.readLater ? t("popup.actions.removeFromReadLater") : t("popup.actions.readLater")}>
            <IconButton onClick={handleReadLater}>
              {currentResult?.readLater ? (
                <BookmarkAddedIcon fontSize="small" />
              ) : (
                <BookmarkBorderIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title={currentResult?.starred ? t("popup.actions.removeFromStarred") : t("popup.actions.starPage")}>
            <IconButton onClick={handleStar}>
              {currentResult?.starred ? (
                <StarIcon fontSize="small" />
              ) : (
                <StarBorderIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip
            title={
              currentResult?.librarySaveStatus === LibrarySaveStatus.Archived
                ? t("common.unarchive")
                : t("popup.actions.archive")
            }
          >
            <IconButton onClick={handleArchive}>
              {currentResult?.librarySaveStatus === LibrarySaveStatus.Archived ? (
                <ArchiveIcon fontSize="small" />
              ) : (
                <ArchiveOutlinedIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </FormRow>

        {/* Saved date + Remove from my list */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pt: 1.5, pb: 0.5 }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Typography sx={FORM_LABEL_SX}>{t("saveDetail.saved")}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.78rem" }}>
              {savedAt ? (
                <>
                  {savedAt.toLocaleDateString(language === "zh-CN" ? "zh-CN" : undefined, { year: "numeric", month: "short", day: "numeric" })}
                  ,{" "}
                  {savedAt.toLocaleTimeString(language === "zh-CN" ? "zh-CN" : undefined, { hour: "numeric", minute: "2-digit" })}
                </>
              ) : t("saveDetail.timeUnavailable")}
            </Typography>
          </Box>
          <Button
            variant="text"
            size="small"
            startIcon={<PlaylistRemoveIcon sx={{ fontSize: 16 }} />}
            onClick={handleRemoveFromLibrary}
            sx={{
              fontSize: "0.78rem",
              textTransform: "none",
              borderRadius: "8px",
              px: 1.5,
              py: 0.5,
              color: "text.secondary",
              "&:hover": {
                color: "error.main",
                backgroundColor: "rgba(211,47,47,0.06)",
              },
            }}
          >
            {t("popup.actions.removeFromMyList")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default SaveDetailPanel;
