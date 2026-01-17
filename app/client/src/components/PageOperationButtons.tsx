import {
  Box, Button,
  Dialog, DialogActions, DialogTitle,
  IconButton,
  Tooltip
} from "@mui/material";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import PlaylistAddCheckOutlinedIcon from '@mui/icons-material/PlaylistAddCheckOutlined';
import ArchiveIcon from '@mui/icons-material/Archive';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import StarIcon from '@mui/icons-material/Star';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import * as React from "react";
import {PageControllerApiFactory, PageOperateResult} from "../api";
import {useMutation} from "@tanstack/react-query";
import {LibrarySaveStatus} from "../interfaces/librarySaveStatus";
import {useEffect, useState} from "react";
import {isDeepEqual} from "../common/objectUtils";
import {ConnectorType} from "../interfaces/connectorType";
import CollectionPickerDialog from "./Dialogs/CollectionPickerDialog";
import {CollectionApi} from "../api/collectionApi";

export enum PageOperation {
  readLater,
  unReadLater,
  star,
  unStar,
  save,
  remove,
  archive,
  delete,
  markRead,
  unMarkRead,
  moveToCollection
}

export type PageStatus = {
  id: number,
  readLater?: boolean,
  starred?: boolean,
  librarySaveStatus?: number;
  markRead?: boolean;
  connectorType?: number;
  collectionId?: number | null;
}

export type PageOperateEvent = {
  result?: PageOperateResult,
  operation: PageOperation,
  rawPageStatus: PageStatus
}

const PageOperationButtons = ({
                                pageStatus,
                                onOperateSuccess
                              }: { pageStatus: PageStatus, onOperateSuccess?: (event: PageOperateEvent) => void }) => {
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openCollectionPicker, setOpenCollectionPicker] = useState(false);
  const [pageState, setPageState] = useState(pageStatus);

  useEffect(() => {
    if (!isDeepEqual(pageState, pageStatus)) {
      setPageState(pageStatus);
    }
  }, [pageStatus]);

  const mutation = useMutation(({page, operation}: { page: PageStatus, operation: PageOperation }) => {
    switch (operation) {
      case PageOperation.readLater:
        return PageControllerApiFactory().readLaterPageUsingPOST(page.id);
      case PageOperation.unReadLater:
        return PageControllerApiFactory().unReadLaterPageUsingPOST(page.id);
      case PageOperation.star:
        return PageControllerApiFactory().starPageUsingPOST(page.id);
      case PageOperation.unStar:
        return PageControllerApiFactory().unStarPageUsingPOST(page.id);
      case PageOperation.save:
        return PageControllerApiFactory().saveToLibraryUsingPOST(page.id);
      case PageOperation.remove:
        return PageControllerApiFactory().removeFromLibraryUsingPOST(page.id);
      case PageOperation.archive:
        return PageControllerApiFactory().archiveToLibraryUsingPOST(page.id);
    }
  }, {
    onMutate: variables => {
      return variables;
    },
    onSuccess: (data, variables, context) => {
      const {operation, page} = variables;
      const res = data.data;
      setPageState({
        ...pageState,
        librarySaveStatus: res.librarySaveStatus,
        readLater: res.readLater,
        starred: res.starred
      });
      if (onOperateSuccess) {
        onOperateSuccess({operation, rawPageStatus: page, result: res});
      }
    },
    onError: (error, variables, context) => {
    },
    onSettled: () => {
    }
  })

  const markReadMutation = useMutation(({page, operation}: { page: PageStatus, operation: PageOperation }) => {
    if (operation === PageOperation.markRead) {
      return PageControllerApiFactory().markReadPageUsingPOST(page.id);
    } else {
      return PageControllerApiFactory().unMarkReadPageUsingPOST(page.id);
    }
  }, {
    onMutate: variables => {
      return variables;
    },
    onSuccess: (data, variables, context) => {
      const {operation, page} = variables;
      setPageState({
        ...pageState,
        markRead: operation === PageOperation.markRead
      });
      if (onOperateSuccess) {
        onOperateSuccess({operation, rawPageStatus: page});
      }
    },
    onError: (error, variables, context) => {
    },
    onSettled: () => {
    }
  })

  const deleteMutation = useMutation(({page}: { page: PageStatus }) => {
    return PageControllerApiFactory().deletePageUsingDELETE(page.id);
  }, {
    onMutate: variables => {
      return variables;
    },
    onSuccess: (data, variables, context) => {
      handleCloseDeleteDialog();
      const {page} = variables;
      if (onOperateSuccess) {
        onOperateSuccess({operation: PageOperation.delete, rawPageStatus: page});
      }
    },
    onError: (error, variables, context) => {
    },
    onSettled: () => {
    }
  })

  function operate(page: PageStatus, operation: PageOperation) {
    if (operation === PageOperation.markRead || operation === PageOperation.unMarkRead) {
      markReadMutation.mutate({page, operation});
    } else {
      mutation.mutate({page, operation});
    }
  }

  function readLater() {
    operate(pageStatus, PageOperation.readLater);
  }

  function unReadLater() {
    operate(pageStatus, PageOperation.unReadLater);
  }

  function star() {
    operate(pageStatus, PageOperation.star);
  }

  function unStar() {
    operate(pageStatus, PageOperation.unStar);
  }

  function save() {
    operate(pageStatus, PageOperation.save);
  }

  function remove() {
    operate(pageStatus, PageOperation.remove);
  }

  function archive() {
    operate(pageStatus, PageOperation.archive);
  }

  function markRead() {
    operate(pageStatus, PageOperation.markRead);
  }

  function unMarkRead() {
    operate(pageStatus, PageOperation.unMarkRead);
  }

  function deletePage() {
    deleteMutation.mutate({page: pageStatus});
  }

  function handleCloseDeleteDialog() {
    setOpenDeleteDialog(false);
  }

  function showDeleteDialog() {
    setOpenDeleteDialog(true);
  }

  function showCollectionPicker() {
    setOpenCollectionPicker(true);
  }

  function handleCloseCollectionPicker() {
    setOpenCollectionPicker(false);
  }

  async function handleSelectCollection(collectionId: number | null) {
    try {
      await CollectionApi.updatePageCollection(pageStatus.id, collectionId);
      setPageState({
        ...pageState,
        collectionId
      });
      if (onOperateSuccess) {
        onOperateSuccess({
          operation: PageOperation.moveToCollection,
          rawPageStatus: pageStatus
        });
      }
    } catch (error) {
      console.error('Failed to move to collection:', error);
    }
  }

  function groupSaveAction(mainIcon, mainAction, mainTooltip, secondaryIcon, secondaryAction, secondaryTooltip) {
    return <div className={"float-right group relative"}>
      <Tooltip title={mainTooltip} placement={"right"}>
        <IconButton onClick={mainAction} className={"group-hover:shadow-heavy group-hover:bg-white"}>
          {mainIcon}
        </IconButton>
      </Tooltip>
      <div className={"group-hover:flex hidden absolute flex-col z-40"}>
        <Tooltip title={"Move to collection"} placement={"right"}>
          <IconButton onClick={showCollectionPicker} className={"mt-2 bg-white shadow-heavy hover:bg-white"}>
            <FolderOutlinedIcon fontSize={"small"}/>
          </IconButton>
        </Tooltip>
        <Tooltip title={secondaryTooltip} placement={"right"}>
          <IconButton onClick={secondaryAction} className={"mt-2 bg-white shadow-heavy hover:bg-white"}>
            {secondaryIcon}
          </IconButton>
        </Tooltip>
        <Tooltip title={"Delete forever"} placement={"right"}>
          <IconButton onClick={showDeleteDialog} className={"mt-2 bg-white shadow-heavy hover:bg-white"}
                      color={"error"}>
            <DeleteForeverIcon fontSize={"small"}/>
          </IconButton>
        </Tooltip>
        <Dialog
          open={openDeleteDialog}
          onClose={handleCloseDeleteDialog}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            {"Are you sure you want to delete this page from database?"}
          </DialogTitle>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
            <Button onClick={deletePage} autoFocus color={'warning'}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
        <CollectionPickerDialog
          open={openCollectionPicker}
          currentCollectionId={pageState.collectionId}
          onClose={handleCloseCollectionPicker}
          onSelect={handleSelectCollection}
        />
      </div>
    </div>;
  }

  const isFromFeeds = pageState.connectorType === ConnectorType.RSS;

  return (
    <div className={'shrink-0'}>
      <Box sx={{}}>
        {isFromFeeds && (
          pageState.markRead ? (
            <Tooltip title={"Mark as unread"}>
              <IconButton onClick={unMarkRead}>
                <CheckCircleOutlineIcon fontSize={"small"}/>
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title={"Mark as read"}>
              <IconButton onClick={markRead}>
                <RadioButtonUncheckedIcon fontSize={"small"}/>
              </IconButton>
            </Tooltip>
          )
        )}
        {
          pageState.readLater ? (
            <Tooltip title={"Remove from read later"}>
              <IconButton onClick={unReadLater}>
                <BookmarkAddedIcon fontSize={"small"}/>
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title={"Read later"}>
              <IconButton onClick={readLater}>
                <BookmarkBorderIcon fontSize={"small"}/>
              </IconButton>
            </Tooltip>
          )
        }
        {
          pageState.starred ? (
            <Tooltip title={"Remove from starred"}>
              <IconButton onClick={unStar}>
                <StarIcon fontSize={"small"}/>
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title={"Star page"}>
              <IconButton onClick={star}>
                <StarBorderIcon fontSize={"small"}/>
              </IconButton>
            </Tooltip>
          )
        }
        {
          pageState.librarySaveStatus === LibrarySaveStatus.Archived ? (
            groupSaveAction(
              <ArchiveIcon fontSize={'small'}/>, save, 'Remove from archive',
              <PlaylistAddCheckOutlinedIcon fontSize={'small'}/>, remove, 'Remove from my list')
          ) : pageState.librarySaveStatus === LibrarySaveStatus.Saved ? (
            groupSaveAction(
              <PlaylistAddCheckOutlinedIcon fontSize={'small'}/>, remove, 'Remove from my list',
              <ArchiveOutlinedIcon fontSize={'small'}/>, archive, 'Archive'
            )
          ) : (
            groupSaveAction(
              <PlaylistAddOutlinedIcon fontSize={"small"}/>, save, 'Save to my list',
              <ArchiveOutlinedIcon fontSize={'small'}/>, archive, 'Archive'
            )
          )
        }
      </Box>
    </div>
  );
}

export default PageOperationButtons;