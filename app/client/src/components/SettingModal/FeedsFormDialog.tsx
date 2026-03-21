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
import { useTranslation } from 'react-i18next';

export default function FeedsFormDialog({feedsId, onClose}: Readonly<{ feedsId: number, onClose: () => void }>) {
  const [open, setOpen] = React.useState(true);
  const { t } = useTranslation(['settings', 'common']);
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
  const api = React.useMemo(() => SettingControllerApiFactory(), []);
  useEffect(() => {
    if (feedsId > 0) {
      api.getFeedsSettingUsingGET(feedsId).then((response) => {
        setFeedsSetting(response.data);
      });
    }
  }, [api, feedsId]);
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
      name: yup.string().required(t('settings:feedNameRequired')),
      enabled: yup.boolean().nullable(),
      crawlFullContent: yup.boolean().nullable(),
      folderId: yup.number().nullable(),
      subscribeUrl: yup.string().required(t('settings:rssLinkRequired')),
      fetchIntervalMinutes: yup.number().min(1, t('settings:fetchIntervalMin')).required(t('settings:fetchIntervalRequired'))
    }),
    onSubmit: (values) => {
      api.updateFeedsSettingUsingPOST(values).then(() => {
        enqueueSnackbar(t('settings:feedUpdated'), {
          variant: "success",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
        handleClose();
      }).catch(() => {
        enqueueSnackbar(t('settings:feedUpdateFailed'), {
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
      enqueueSnackbar(t('settings:feedDeleted'), {
        variant: "success",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
      handleClose();
    }).catch(() => {
      enqueueSnackbar(t('settings:feedDeleteFailed'), {
        variant: "error",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    });
  }

  return <React.Fragment>
    <Dialog open={open} onClose={handleClose}>
      <form onSubmit={formikFeeds.handleSubmit} className={'w-[500px]'}>
        <DialogTitle>{feedsId === null || feedsId === 0 ? t('settings:addFeed') : t('settings:editFeed')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {formikFeeds.values.subscribeUrl}
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label={t('settings:feedName')}
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
              label={t('settings:fetchInterval')}
              value={formikFeeds.values.fetchIntervalMinutes}
              onChange={formikFeeds.handleChange}
              error={formikFeeds.touched.fetchIntervalMinutes && Boolean(formikFeeds.errors.fetchIntervalMinutes)}
              helperText={formikFeeds.touched.fetchIntervalMinutes && formikFeeds.errors.fetchIntervalMinutes}
              type="number"
              variant="standard"
            />
            <FormControl className={'w-[200px]'} margin={"normal"}>
              <InputLabel size={'small'}>{t('settings:folder')}</InputLabel>
              {
                folders && <Select
                      name={"folderId"}
                      value={formikFeeds.values.folderId || 0}
                      label={t('settings:folder')}
                      onChange={formikFeeds.handleChange}
                      size={'small'}
                  >
                  {
                    folders.map((folder) => {
                      return <MenuItem key={folder.id || 0} value={folder.id || 0}
                                       sx={{color:folder.name ? '#000' : '#666'}}>{folder.name || t('settings:noFolder')}</MenuItem>;
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
                            label={t('common:enable')}/>
          <FormControlLabel className={''}
                            control={<Checkbox value={true} name={'crawlFullContent'}
                                               onChange={formikFeeds.handleChange}
                                               checked={!!formikFeeds.values.crawlFullContent}/>
                            }
                            label={t('settings:feedCrawlFullContent')}/>
        </DialogContent>
        <DialogActions>
          {
            feedsId > 0 &&
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
        {t('settings:deleteFeedConfirm')}
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