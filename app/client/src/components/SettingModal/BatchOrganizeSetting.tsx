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

const CONTENT_TYPE_OPTIONS: { value: ContentTypeFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ARTICLE", label: "Article" },
  { value: "TWEET", label: "Tweet" },
  { value: "SNIPPET", label: "Snippet" },
];

// Helper type for tree structure
interface CollectionOption {
  id: number | null;
  name: string;
  isGroup?: boolean;
  depth?: number;
}

export default function BatchOrganizeSetting() {
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
    } catch (error: any) {
      enqueueSnackbar(error.message || "Failed to filter pages", { variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [buildQuery, enqueueSnackbar]);

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
      enqueueSnackbar(`Successfully moved ${result.successCount} pages`, { variant: "success" });
      setDialogOpen(false);
      handleFilter(); // Refresh preview
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to move pages";
      enqueueSnackbar(errorMessage, { variant: "error" });
    }
  }, [buildQuery, enqueueSnackbar, handleFilter]);

  return (
    <div>
      <SettingSectionTitle first icon={DriveFileMoveIcon} description="Filter and batch move pages to collections.">
        Batch Organize
      </SettingSectionTitle>

      {/* Filter Form */}
      <Box className="mt-4 space-y-3">
        {/* Row 1: Collection, Library, Type */}
        <Box className="flex gap-3 items-center flex-wrap">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Collection</InputLabel>
            <Select
              value={collectionId === "UNSORTED" ? "UNSORTED" : (collectionId ?? "")}
              label="Collection"
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") setCollectionId(null);
                else if (val === "UNSORTED") setCollectionId("UNSORTED");
                else setCollectionId(Number(val));
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="UNSORTED">Unsorted</MenuItem>
              {collectionOptions.map((c, idx) =>
                c.isGroup ? (
                  <ListSubheader key={`group-${idx}`} sx={{ lineHeight: "32px", fontWeight: 600 }}>
                    {c.name}
                  </ListSubheader>
                ) : (
                  <MenuItem key={c.id} value={c.id!} sx={{ pl: 2 + (c.depth || 0) * 2 }}>
                    {c.name}
                  </MenuItem>
                )
              )}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Library</InputLabel>
            <Select value={saveStatus} label="Library" onChange={(e) => setSaveStatus(e.target.value as "ALL" | "SAVED" | "ARCHIVED")}>
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="SAVED">My List</MenuItem>
              <MenuItem value="ARCHIVED">Archive</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={contentType}
              label="Type"
              onChange={(e) => setContentType(e.target.value as ContentTypeFilter)}
            >
              {CONTENT_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Row 2: Date range */}
        <Box className="flex gap-3 items-center">
          <TextField
            size="small"
            type="date"
            label="From"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150 }}
          />
          <TextField
            size="small"
            type="date"
            label="To"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150 }}
          />
        </Box>

        {/* Row 3: Starred, Read Later */}
        <Box className="flex gap-3 items-center">
          <FormControlLabel control={<Checkbox checked={starred} onChange={(e) => setStarred(e.target.checked)} size="small" />} label="Starred" />
          <FormControlLabel control={<Checkbox checked={readLater} onChange={(e) => setReadLater(e.target.checked)} size="small" />} label="Read Later" />
        </Box>

        {/* Row 4: Author */}
        <Box>
          <TextField
            size="small"
            label="Author"
            placeholder="Filter by author..."
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            sx={{ width: 280 }}
          />
        </Box>

        {/* Row 5: Filter button */}
        <Box>
          <Button variant="contained" startIcon={isLoading ? <CircularProgress size={16} /> : <SearchIcon />} onClick={handleFilter} disabled={isLoading}>
            Filter
          </Button>
        </Box>

        <Divider className="my-4" />

        {/* Filter Result Preview */}
        {filterResult && (
          <Box className="space-y-3">
            <Alert severity="info">
              Found <strong>{filterResult.totalCount}</strong> pages matching your criteria.
            </Alert>
            {filterResult.items.length > 0 && (
              <>
                <BatchPageItemList items={filterResult.items.slice(0, 5)} />
                {filterResult.totalCount > 5 && (
                  <Button variant="outlined" size="small" onClick={handleViewMore}>
                    View More ({filterResult.totalCount} total)
                  </Button>
                )}
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

