import {Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField} from "@mui/material";
import React, {useEffect, useState} from "react";
import {Folder, FolderControllerApiFactory, SettingControllerApiFactory} from "../../api";
import {useFormik} from "formik";
import * as yup from "yup";
import {useSnackbar} from "notistack";

export default function FolderFormDialog({folderId, onClose}: { folderId: number, onClose: () => void }) {
  const [open, setOpen] = React.useState(true);
  const [folder, setFolder] = React.useState<Folder>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const {enqueueSnackbar} = useSnackbar();
  useEffect(() => {
    if (folderId>0) {
      FolderControllerApiFactory().getFolderByIdUsingGET(folderId).then((response) => {
        setFolder(response.data);
      });
    }
  }, [folderId]);

  function handleClose() {
    setOpen(false);
    onClose();
  }

  const formikFolder = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: folder?.name || '',
      id: folder?.id || null
    },
    validationSchema: yup.object({
      name: yup.string().required('Folder name is required.')
    }),
    onSubmit: (values) => {
      SettingControllerApiFactory().saveFolderUsingPOST(values).then(() => {
        enqueueSnackbar('Save folder success.', {
          variant: "success",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
        handleClose();
      }).catch((err) => {
        enqueueSnackbar('Save folder failed. Error: ' + err, {
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
    SettingControllerApiFactory().deleteFolderUsingPOST(folderId).then(() => {
      enqueueSnackbar('Delete folder success.', {
        variant: "success",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
      handleClose();
    }).catch((err) => {
      enqueueSnackbar('Delete folder failed. Error: ' + err, {
        variant: "error",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    });
  }

  return <React.Fragment>
    <Dialog open={open} onClose={handleClose}>
      <form onSubmit={formikFolder.handleSubmit}>
        <DialogTitle>{folderId === null || folderId === 0 ? "Create New Folder" : "Edit Folder"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Group your feeds into a private folder by topic, type, or project.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Folder name"
            value={formikFolder.values.name}
            onChange={formikFolder.handleChange}
            error={formikFolder.touched.name && Boolean(formikFolder.errors.name)}
            helperText={formikFolder.touched.name && formikFolder.errors.name}
            type="text"
            fullWidth
            variant="standard"
          />
        </DialogContent>
        <DialogActions>
          {
            folderId > 0 &&
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
        {"Feeds under folder will move to root folder, do you want to delete it?"}
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