import {Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField} from "@mui/material";
import React, {useEffect, useState} from "react";
import {Folder, FolderControllerApiFactory, SettingControllerApiFactory} from "../../api";
import {useFormik} from "formik";
import * as yup from "yup";
import {useSnackbar} from "notistack";
import { useTranslation } from 'react-i18next';

export default function FolderFormDialog({folderId, onClose}: Readonly<{ folderId: number, onClose: () => void }>) {
  const [open, setOpen] = React.useState(true);
  const { t } = useTranslation(['settings', 'common']);
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
      name: yup.string().required(t('settings:folderNameRequired'))
    }),
    onSubmit: (values) => {
      SettingControllerApiFactory().saveFolderUsingPOST(values).then(() => {
        enqueueSnackbar(t('settings:folderSaved'), {
          variant: "success",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
        handleClose();
      }).catch(() => {
        enqueueSnackbar(t('settings:folderSaveFailed'), {
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
      enqueueSnackbar(t('settings:folderDeleted'), {
        variant: "success",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
      handleClose();
    }).catch(() => {
      enqueueSnackbar(t('settings:folderDeleteFailed'), {
        variant: "error",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    });
  }

  return <React.Fragment>
    <Dialog open={open} onClose={handleClose}>
      <form onSubmit={formikFolder.handleSubmit}>
        <DialogTitle>{folderId === null || folderId === 0 ? t('settings:addFolder') : t('settings:editFolder')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('settings:folderDescription')}
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label={t('settings:folderName')}
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
              <Button color={"warning"} onClick={showDeleteDialog}>{t('common:delete')}</Button>
          }
          <Button onClick={handleClose}>{t('common:cancel')}</Button>
          <Button type={'submit'}>{t('common:save')}</Button>
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
        {t('settings:deleteFolder')}
      </DialogTitle>
      <DialogActions>
        <Button onClick={handleCloseDeleteDialog}>{t('common:cancel')}</Button>
        <Button onClick={handleDelete} autoFocus color={'warning'}>
          {t('common:delete')}
        </Button>
      </DialogActions>
    </Dialog>
  </React.Fragment>;
}