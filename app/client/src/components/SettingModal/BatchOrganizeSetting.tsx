import { useState, useCallback, useEffect } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  ListSubheader,
} from "@mui/material";
import { useSnackbar } from "notistack";
import SettingSectionTitle from "./SettingSectionTitle";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import SearchIcon from "@mui/icons-material/Search";
import {
  BatchFilterQuery,
  BatchFilterResult,
  ContentTypeFilter,
  CollectedAtMode,
  filterPages,
  batchMoveToCollection,
} from "../../api/batchOrganize";
import { CollectionApi, CollectionTreeVO, CollectionVO } from "../../api/collectionApi";
import BatchOrganizeDialog from "../Dialogs/BatchOrganizeDialog";
import BatchPageItemList from "../BatchPageItemList";
import { Trans, useTranslation } from 'react-i18next';

const CONTENT_TYPE_OPTIONS: ContentTypeFilter[] = ["ALL", "ARTICLE", "TWEET", "SNIPPET"];

// Helper type for tree structure
interface CollectionOption {
  id: number | null;
  name: string;
  isGroup?: boolean;
  depth?: number;
}

export default function BatchOrganizeSetting() {
  const { t } = useTranslation(['settings', 'navigation', 'common', 'page']);
  const { enqueueSnackbar } = useSnackbar();

  // Filter state
  const [saveStatus, setSaveStatus] = useState<"ALL" | "SAVED" | "ARCHIVED">("ALL");
  const [contentType, setContentType] = useState<ContentTypeFilter>("ALL");
  const [collectionId, setCollectionId] = useState<number | null | "UNSORTED">("UNSORTED");
  const [starred, setStarred] = useState(false);
  const [readLater, setReadLater] = useState(false);
  const [author, setAuthor] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [filterResult, setFilterResult] = useState<BatchFilterResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [collections, setCollections] = useState<CollectionTreeVO | null>(null);

  // Load collections on mount
  useEffect(() => {
    CollectionApi.getTree()
      .then(setCollections)
      .catch((err) => console.error("Failed to load collections:", err));
  }, []);

  // Build collection tree options for select dropdown
  const buildCollectionOptions = useCallback((tree: CollectionTreeVO | null): CollectionOption[] => {
    if (!tree) return [];
    const result: CollectionOption[] = [];
    const addCollection = (c: CollectionVO, depth: number = 0) => {
      result.push({ id: c.id, name: c.name, depth });
      c.children?.forEach((child) => addCollection(child, depth + 1));
    };
    tree.groups.forEach((g) => {
      result.push({ id: null, name: g.name, isGroup: true, depth: 0 });
      g.collections.forEach((c) => addCollection(c, 1));
    });
    return result;
  }, []);

  const collectionOptions = buildCollectionOptions(collections);

  const getContentTypeLabel = useCallback((value: ContentTypeFilter) => {
    switch (value) {
      case "ALL":
        return t('common:all');
      case "ARTICLE":
        return t('page:article');
      case "TWEET":
        return t('page:tweet');
      case "SNIPPET":
        return t('page:snippet');
      default:
        return value;
    }
  }, [t]);

  const batchPageLabels = {
    openOriginal: t('page:openOriginal'),
    author: t('settings:author'),
    collected: t('page:sortByCollected'),
    published: t('page:published'),
  };

  const buildQuery = useCallback((): BatchFilterQuery => {
    return {
      saveStatus: saveStatus === "ALL" ? undefined : saveStatus,
      contentType: contentType === "ALL" ? undefined : contentType,
      collectionId: collectionId === "UNSORTED" ? undefined : collectionId ?? undefined,
      filterUnsorted: collectionId === "UNSORTED" ? true : undefined,
      starred: starred || undefined,
      readLater: readLater || undefined,
      author: author.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 0,
      size: 5,
    };
  }, [saveStatus, contentType, collectionId, starred, readLater, author, startDate, endDate]);

  const handleFilter = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await filterPages(buildQuery());
      setFilterResult(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "";
      enqueueSnackbar(errorMessage || t('settings:filterPagesFailed'), { variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [buildQuery, enqueueSnackbar, t]);

  const handleViewMore = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const handleBatchMove = useCallback(async (
    selectAll: boolean,
    pageIds: number[],
    dialogTargetCollectionId: number | null,
    dialogCollectedAtMode: CollectedAtMode
  ) => {
    try {
      const result = await batchMoveToCollection({
        selectAll,
        pageIds: selectAll ? undefined : pageIds,
        filterQuery: selectAll ? buildQuery() : undefined,
        targetCollectionId: dialogTargetCollectionId,
        collectedAtMode: dialogCollectedAtMode,
      });
      enqueueSnackbar(t('settings:batchMoveSuccess', { count: result.successCount }), { variant: "success" });
      setDialogOpen(false);
      handleFilter(); // Refresh preview
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "";
      enqueueSnackbar(errorMessage || t('settings:batchMoveFailed'), { variant: "error" });
    }
  }, [buildQuery, enqueueSnackbar, handleFilter, t]);

  return (
    <div>
      <SettingSectionTitle first icon={DriveFileMoveIcon} description={t('settings:batchOrganizeDesc')}>
        {t('settings:batchOrganize')}
      </SettingSectionTitle>

      {/* Filter Form */}
      <Box className="mt-4 space-y-3">
        {/* Row 1: Collection, Library, Type */}
        <Box className="flex gap-3 items-center flex-wrap">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('navigation:collections')}</InputLabel>
            <Select
              value={collectionId === "UNSORTED" ? "UNSORTED" : (collectionId ?? "")}
              label={t('navigation:collections')}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") setCollectionId(null);
                else if (val === "UNSORTED") setCollectionId("UNSORTED");
                else setCollectionId(Number(val));
              }}
            >
              <MenuItem value="">{t('common:all')}</MenuItem>
              <MenuItem value="UNSORTED">{t('navigation:unsorted')}</MenuItem>
              {collectionOptions.map((c) =>
                c.isGroup ? (
                  <ListSubheader key={`group-${c.name}`} sx={{ lineHeight: "32px", fontWeight: 600 }}>
                    {c.name}
                  </ListSubheader>
                ) : (
                  <MenuItem key={c.id} value={c.id} sx={{ pl: 2 + (c.depth || 0) * 2 }}>
                    {c.name}
                  </MenuItem>
                )
              )}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>{t('settings:library')}</InputLabel>
            <Select value={saveStatus} label={t('settings:library')} onChange={(e) => setSaveStatus(e.target.value as "ALL" | "SAVED" | "ARCHIVED")}>
              <MenuItem value="ALL">{t('settings:libraryStatus')}</MenuItem>
              <MenuItem value="SAVED">{t('settings:myList')}</MenuItem>
              <MenuItem value="ARCHIVED">{t('settings:archive')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>{t('settings:type')}</InputLabel>
            <Select
              value={contentType}
              label={t('settings:type')}
              onChange={(e) => setContentType(e.target.value as ContentTypeFilter)}
            >
              {CONTENT_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>{getContentTypeLabel(opt)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Row 2: Date range */}
        <Box className="flex gap-3 items-center">
          <TextField
            size="small"
            type="date"
            label={t('settings:from')}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150 }}
          />
          <TextField
            size="small"
            type="date"
            label={t('settings:to')}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150 }}
          />
        </Box>

        {/* Row 3: Starred, Read Later */}
        <Box className="flex gap-3 items-center">
          <FormControlLabel control={<Checkbox checked={starred} onChange={(e) => setStarred(e.target.checked)} size="small" />} label={t('settings:starred')} />
          <FormControlLabel control={<Checkbox checked={readLater} onChange={(e) => setReadLater(e.target.checked)} size="small" />} label={t('settings:readLater')} />
        </Box>

        {/* Row 4: Author */}
        <Box>
          <TextField
            size="small"
            label={t('settings:author')}
            placeholder={t('settings:filterDesc')}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            sx={{ width: 280 }}
          />
        </Box>

        {/* Row 5: Filter button */}
        <Box>
          <Button variant="contained" startIcon={isLoading ? <CircularProgress size={16} /> : <SearchIcon />} onClick={handleFilter} disabled={isLoading}>
            {t('settings:filterBtn')}
          </Button>
        </Box>

        <Divider className="my-4" />

        {/* Filter Result Preview */}
        {filterResult && (
          <Box className="space-y-3">
            <Alert severity="info">
              <Trans
                i18nKey="settings:foundPages"
                count={filterResult.totalCount}
                values={{ count: filterResult.totalCount }}
                components={{ strong: <strong /> }}
              />
            </Alert>
            {filterResult.items.length > 0 && (
              <>
                <BatchPageItemList items={filterResult.items.slice(0, 5)} labels={batchPageLabels} />
                <Button variant="outlined" size="small" onClick={handleViewMore}>
                  {filterResult.totalCount === 1
                    ? t('settings:organizeBtn')
                    : `${t('settings:batchOrganizeBtn')} (${filterResult.totalCount})`}
                </Button>
              </>
            )}

          </Box>
        )}
      </Box>

      {/* Batch Organize Dialog */}
      <BatchOrganizeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        filterQuery={buildQuery()}
        targetCollectionId={null}
        collectedAtMode="KEEP"
        collectionOptions={collectionOptions}
        onMove={handleBatchMove}
      />
    </div>
  );
}

