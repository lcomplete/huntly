import React, {useEffect, useState} from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent, DialogContentText,
  DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Select,
  TextField
} from "@mui/material";
import {
  FeedsSetting,
  SettingControllerApiFactory
} from "../../api";
import {useSnackbar} from "notistack";
import {useFormik} from "formik";
import * as yup from "yup";
import {useQuery} from "@tanstack/react-query";

export default function FeedsFormDialog({feedsId, onClose}: { feedsId: number, onClose: () => void }) {
  const [open, setOpen] = React.useState(true);
  const [feedsSetting, setFeedsSetting] = React.useState<FeedsSetting>({
    connectorId: 0,
    name: '',
    enabled: false,
    crawlFullContent: false,
    fetchIntervalMinutes: 0,
    folderId: 0
  });
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const {enqueueSnackbar} = useSnackbar();
  const api = SettingControllerApiFactory();
  useEffect(() => {
    if (feedsId > 0) {
      api.getFeedsSettingUsingGET(feedsId).then((response) => {
        setFeedsSetting(response.data);
      });
    }
  }, [feedsId]);
  const {
    data: folders
  } = useQuery(["selecting-folders"], async () => (await api.getSortedFoldersUsingGET()).data);

  function handleClose() {
    setOpen(false);
    onClose();
  }

  const formikFeeds = useFormik({
    enableReinitialize: true,
    initialValues: {
      ...feedsSetting
    },
    validationSchema: yup.object({
      name: yup.string().required('Feed name is required.'),
      enabled: yup.boolean().nullable(),
      crawlFullContent: yup.boolean().nullable(),
      folderId: yup.number().nullable(),
      subscribeUrl: yup.string().required('Subscribe URL is required.'),
      fetchIntervalMinutes: yup.number().min(1,"Fetch interval can't less than 1.").required('Fetch interval is required.')
    }),
    onSubmit: (values) => {
      api.updateFeedsSettingUsingPOST(values).then(() => {
        enqueueSnackbar('Update feed success.', {
          variant: "success",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
        handleClose();
      }).catch((err) => {
        enqueueSnackbar('Update feed failed. Error: ' + err, {
          variant: "error",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
      });
    }
  })

  function handleCloseDeleteDialog() {
    setOpenDeleteDialog(false);
  }

  function showDeleteDialog() {
    setOpenDeleteDialog(true);
  }

  function handleDelete() {
    api.deleteFeedUsingPOST(feedsId).then(() => {
      enqueueSnackbar('Delete feed success.', {
        variant: "success",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
      handleClose();
    }).catch((err) => {
      enqueueSnackbar('Delete feed failed. Error: ' + err, {
        variant: "error",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    });
  }

  return <React.Fragment>
    <Dialog open={open} onClose={handleClose}>
      <form onSubmit={formikFeeds.handleSubmit} className={'w-[500px]'}>
        <DialogTitle>{feedsId === null || feedsId === 0 ? "Create New Feed" : "Manage Feed"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {formikFeeds.values.subscribeUrl}
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Feed name"
            value={formikFeeds.values.name}
            onChange={formikFeeds.handleChange}
            error={formikFeeds.touched.name && Boolean(formikFeeds.errors.name)}
            helperText={formikFeeds.touched.name && formikFeeds.errors.name}
            type="text"
            fullWidth
            variant="standard"
          />
          <div className={'flex justify-between mt-2'}>
            <TextField
              margin="dense"
              id="fetchIntervalMinutes"
              label="Fetch interval minutes"
              value={formikFeeds.values.fetchIntervalMinutes}
              onChange={formikFeeds.handleChange}
              error={formikFeeds.touched.fetchIntervalMinutes && Boolean(formikFeeds.errors.fetchIntervalMinutes)}
              helperText={formikFeeds.touched.fetchIntervalMinutes && formikFeeds.errors.fetchIntervalMinutes}
              type="number"
              variant="standard"
            />
            <FormControl className={'w-[200px]'} margin={"normal"}>
              <InputLabel size={'small'}>Folder</InputLabel>
              {
                folders && <Select
                      name={"folderId"}
                      value={formikFeeds.values.folderId || 0}
                      label="Folder"
                      onChange={formikFeeds.handleChange}
                      size={'small'}
                  >
                  {
                    folders.map((folder) => {
                      return <MenuItem key={folder.id || 0} value={folder.id || 0}
                                       sx={{color:folder.name ? '#000' : '#666'}}>{folder.name || 'Root Folder'}</MenuItem>;
                    })
                  }
                  </Select>
              }
            </FormControl>
          </div>
          <FormControlLabel className={''}
                            control={<Checkbox value={true} name={'enabled'} onChange={formikFeeds.handleChange}
                                               checked={!!formikFeeds.values.enabled}/>
                            }
                            label="Enable"/>
          <FormControlLabel className={''}
                            control={<Checkbox value={true} name={'crawlFullContent'}
                                               onChange={formikFeeds.handleChange}
                                               checked={!!formikFeeds.values.crawlFullContent}/>
                            }
                            label="Auto fetch full content"/>
        </DialogContent>
        <DialogActions>
          {
            feedsId > 0 &&
              <Button color={"warning"} onClick={showDeleteDialog}>Delete</Button>
          }
          <Button onClick={handleClose}>Cancel</Button>
          <Button type={'submit'}>Submit</Button>
        </DialogActions>
      </form>
    </Dialog>
    <Dialog
      open={openDeleteDialog}
      onClose={handleCloseDeleteDialog}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        {"Article in library will not delete, do you want to delete this feed?"}
      </DialogTitle>
      <DialogActions>
        <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
        <Button onClick={handleDelete} autoFocus color={'warning'}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  </React.Fragment>;
}