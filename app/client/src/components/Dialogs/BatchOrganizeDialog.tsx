import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  ListSubheader,
  MenuItem,
  Pagination,
  Select,
  Typography,
} from "@mui/material";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import { useSnackbar } from "notistack";
import {
  BatchFilterQuery,
  BatchFilterResult,
  CollectedAtMode,
  COLLECTED_AT_MODE_OPTIONS,
  filterPages,
} from "../../api/batchOrganize";
import BatchPageItemList from "../BatchPageItemList";

interface CollectionOption {
  readonly id: number | null;
  readonly name: string;
  readonly isGroup?: boolean;
  readonly depth?: number;
}

interface BatchOrganizeDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly filterQuery: BatchFilterQuery;
  readonly targetCollectionId: number | null;
  readonly collectedAtMode: CollectedAtMode;
  readonly collectionOptions: readonly CollectionOption[];
  readonly onMove: (selectAll: boolean, pageIds: number[], targetCollectionId: number | null, collectedAtMode: CollectedAtMode) => void;
}

const PAGE_SIZE = 20;

export default function BatchOrganizeDialog({
  open,
  onClose,
  filterQuery,
  targetCollectionId: initialTargetCollectionId,
  collectedAtMode: initialCollectedAtMode,
  collectionOptions,
  onMove,
}: BatchOrganizeDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BatchFilterResult | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [targetCollectionId, setTargetCollectionId] = useState<number | null>(initialTargetCollectionId);
  const [collectedAtMode, setCollectedAtMode] = useState<CollectedAtMode>(initialCollectedAtMode);
  const [showCollectionError, setShowCollectionError] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentPage(0);
      setSelectedIds(new Set());
      setSelectAll(false);
      setTargetCollectionId(initialTargetCollectionId);
      setCollectedAtMode(initialCollectedAtMode);
    }
  }, [open, initialTargetCollectionId, initialCollectedAtMode]);

  // Load data when page changes
  useEffect(() => {
    if (!open) return;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await filterPages({ ...filterQuery, page: currentPage, size: PAGE_SIZE });
        setResult(data);
      } catch (error) {
        console.error("Failed to load pages:", error);
        setResult(null);
        enqueueSnackbar("Failed to load pages. Please try again.", { variant: "error" });
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [open, filterQuery, currentPage, enqueueSnackbar]);

  const handleSelectItem = useCallback((id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
    if (!checked) {
      setSelectAll(false);
    }
  }, []);

  const handleSelectAllOnPage = useCallback((checked: boolean) => {
    if (!result) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      result.items.forEach((item) => {
        if (checked) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      });
      return next;
    });
  }, [result]);

  const handleSelectAllGlobal = useCallback((checked: boolean) => {
    setSelectAll(checked);
    if (!checked) {
      setSelectedIds(new Set());
    }
  }, []);

  const handleMove = useCallback(() => {
    // Validate target collection is selected
    if (targetCollectionId === null) {
      setShowCollectionError(true);
      enqueueSnackbar("Please select a target collection", { variant: "warning" });
      return;
    }
    setShowCollectionError(false);
    if (selectAll) {
      onMove(true, [], targetCollectionId, collectedAtMode);
    } else {
      onMove(false, Array.from(selectedIds), targetCollectionId, collectedAtMode);
    }
  }, [selectAll, selectedIds, onMove, targetCollectionId, collectedAtMode, enqueueSnackbar]);

  const allOnPageSelected = result?.items.every((item) => selectedIds.has(item.id)) ?? false;
  const someOnPageSelected = result?.items.some((item) => selectedIds.has(item.id)) ?? false;
  const selectionCount = selectAll ? (result?.totalCount ?? 0) : selectedIds.size;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: "80vh" } }}>
      <DialogTitle>Batch Organize Pages</DialogTitle>
      <DialogContent dividers>
        {/* Selection controls */}
        <Box className="flex items-center gap-4 mb-4">
          <FormControlLabel
            control={<Checkbox checked={selectAll} onChange={(e) => handleSelectAllGlobal(e.target.checked)} />}
            label={`Select all ${result?.totalCount ?? 0} pages`}
          />
          {!selectAll && selectedIds.size > 0 && (
            <Typography variant="body2" color="text.secondary">
              {selectedIds.size} selected
            </Typography>
          )}
        </Box>

        {/* List */}
        {isLoading ? (
          <Box className="flex justify-center py-8">
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Select all on this page */}
            <Box
              className="flex items-center gap-2 p-2 border rounded mb-2"
              sx={{ bgcolor: "action.hover", cursor: selectAll ? "default" : "pointer" }}
              onClick={() => !selectAll && handleSelectAllOnPage(!allOnPageSelected)}
            >
              <Checkbox
                size="small"
                checked={allOnPageSelected && (result?.items.length ?? 0) > 0}
                indeterminate={someOnPageSelected && !allOnPageSelected}
                disabled={selectAll}
                sx={{ ml: -0.5 }}
              />
              <Typography variant="body2">Select all on this page</Typography>
            </Box>

            {/* Page items list */}
            <Box sx={{ maxHeight: 400, overflow: "auto" }}>
              <BatchPageItemList
                items={result?.items ?? []}
                selectable
                selectedIds={selectedIds}
                selectAll={selectAll}
                onSelectItem={handleSelectItem}
              />
            </Box>

            {/* Pagination */}
            {result && result.totalPages > 1 && (
              <Box className="flex justify-center mt-4">
                <Pagination
                  count={result.totalPages}
                  page={currentPage + 1}
                  onChange={(_, page) => setCurrentPage(page - 1)}
                  color="primary"
                />
              </Box>
            )}
          </>
        )}
      </DialogContent>

      {/* Move Options and Actions - all in one row */}
      <Divider />
      <DialogActions sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 2, p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>

        <Box className="flex gap-3 items-center flex-wrap">
          <FormControl size="small" sx={{ minWidth: 200 }} error={showCollectionError}>
            <InputLabel>Target Collection</InputLabel>
            <Select
              value={targetCollectionId ?? ""}
              label="Target Collection"
              onChange={(e) => {
                const val = e.target.value;
                setTargetCollectionId(val === "" ? null : Number(val));
                if (val !== "") setShowCollectionError(false);
              }}
            >
              <MenuItem value="" disabled><em>Select a collection...</em></MenuItem>
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
            {showCollectionError && <FormHelperText>Please select a collection</FormHelperText>}
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Collected Time</InputLabel>
            <Select value={collectedAtMode} label="Collected Time" onChange={(e) => setCollectedAtMode(e.target.value as CollectedAtMode)}>
              {COLLECTED_AT_MODE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button variant="contained" startIcon={<DriveFileMoveIcon />} onClick={handleMove} disabled={selectionCount === 0}>
            Move {selectionCount} Pages
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

