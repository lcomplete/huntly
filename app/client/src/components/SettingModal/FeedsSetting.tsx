import Typography from "@mui/material/Typography";
import {
  Avatar,
  Box,
  Button,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItemAvatar,
  ListItemText,
  Switch,
  Tab,
  Tabs,
  TextField
} from "@mui/material";
import SettingSectionTitle from "./SettingSectionTitle";
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { PreviewFeedsInfo, SettingControllerApiFactory } from "../../api";
import { useSnackbar } from "notistack";
import { useFormik } from "formik";
import * as yup from "yup";
import SearchIcon from "@mui/icons-material/Search";
import CardMedia from "@mui/material/CardMedia";
import CardContent from "@mui/material/CardContent";
import Card from "@mui/material/Card";
import RssFeedIcon from "@mui/icons-material/RssFeed";
import { AxiosRequestConfig } from 'axios';
import { useGlobalSettings } from "../../contexts/GlobalSettingsContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import EditIcon from '@mui/icons-material/Edit';
import FolderIcon from '@mui/icons-material/Folder';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { styled } from "@mui/material/styles";
import FolderFormDialog from "./FolderFormDialog";
import FeedsFormDialog from "./FeedsFormDialog";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { reorder } from "../../common/arrayUtils";
import { useTranslation } from 'react-i18next';
import DeleteConfirmDialog from "../DeleteConfirmDialog";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: Readonly<TabPanelProps>) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`feeds-tabpanel-${index}`}
      aria-labelledby={`feeds-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `feeds-tab-${index}`,
    'aria-controls': `feeds-tabpanel-${index}`,
  };
}

export const FeedsSetting = () => {
  const { t } = useTranslation(['settings']);
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <div>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label={t('settings:feeds')}>
          <Tab icon={<RssFeedIcon />} iconPosition="start" label={t('settings:feeds')} {...a11yProps(0)} sx={{ minHeight: 48 }} />
          <Tab icon={<FolderIcon />} iconPosition="start" label={t('settings:folder')} {...a11yProps(1)} sx={{ minHeight: 48 }} />
        </Tabs>
      </Box>
      <TabPanel value={tabValue} index={0}>
        <FeedsTabContent />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <FoldersTabContent />
      </TabPanel>
    </div>
  );
};

function FeedsTabContent() {
  const { t } = useTranslation(['settings', 'common']);
  const [file, setFile] = useState<File>();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const api = SettingControllerApiFactory();
  const { markReadOnScroll, setMarkReadOnScroll } = useGlobalSettings();
  const {
    data: globalSetting,
    refetch: refetchGlobalSetting
  } = useQuery(["global-setting-for-feeds"], async () => (await api.getGlobalSettingUsingGET()).data);

  const formikDefaultFeedSetting = useFormik({
    enableReinitialize: true,
    initialValues: {
      defaultFeedFetchIntervalMinutes: globalSetting?.defaultFeedFetchIntervalMinutes || 10
    },
    validationSchema: yup.object({
      defaultFeedFetchIntervalMinutes: yup.number()
        .typeError(t('settings:defaultFeedFetchIntervalRequired'))
        .required(t('settings:defaultFeedFetchIntervalRequired'))
        .min(1, t('settings:defaultFeedFetchIntervalMin'))
    }),
    onSubmit: async (values) => {
      if (!globalSetting) {
        return;
      }

      try {
        await api.saveGlobalSettingUsingPOST({
          ...globalSetting,
          defaultFeedFetchIntervalMinutes: values.defaultFeedFetchIntervalMinutes
        });
        await refetchGlobalSetting();
        enqueueSnackbar(t('settings:defaultFeedFetchIntervalSaved'), {
          variant: "success",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      } catch (err) {
        enqueueSnackbar(t('settings:defaultFeedFetchIntervalSaveFailed'), {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      }
    }
  });

  async function handleDefaultFeedFetchIntervalBlur(event: React.FocusEvent<HTMLInputElement>) {
    formikDefaultFeedSetting.handleBlur(event);

    if (!globalSetting || !formikDefaultFeedSetting.dirty) {
      return;
    }

    const errors = await formikDefaultFeedSetting.validateForm();
    if (errors.defaultFeedFetchIntervalMinutes) {
      return;
    }

    await formikDefaultFeedSetting.submitForm();
  }

  function handleDefaultFeedFetchIntervalChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    formikDefaultFeedSetting.setFieldValue(
      'defaultFeedFetchIntervalMinutes',
      value === '' ? '' : Number(value)
    );
  }

  async function handleMarkReadOnScrollChange(event: React.ChangeEvent<HTMLInputElement>) {
    const newValue = event.target.checked;

    try {
      // Update local state immediately for better UX
      setMarkReadOnScroll(newValue);

      // Save to server
      const res = await api.getGlobalSettingUsingGET();
      const globalSetting = res.data as any;
      globalSetting.markReadOnScroll = newValue;
      await api.saveGlobalSettingUsingPOST(globalSetting);

      enqueueSnackbar(t('settings:settingSaved'), {
        variant: "success",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    } catch (err) {
      // Revert on error
      setMarkReadOnScroll(!newValue);
      console.error('Failed to save setting', err);
      enqueueSnackbar(t('settings:settingSaveFailed'), {
        variant: "error",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    }
  }

  function uploadOpml() {
    if (!file) {
      return;
    }
    setImporting(true);
    api.importOpmlUsingPOST(file).then(() => {
      enqueueSnackbar(t('settings:importSuccess'), {
        variant: "success",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    }).catch(() => {
      enqueueSnackbar(t('settings:importFailed'), {
        variant: "error",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    }).finally(() => {
      setImporting(false);
    });
  }

  function downloadOpml() {
    const options: AxiosRequestConfig = {
      responseType: 'blob',
    };
    setExporting(true);
    api.exportOpmlUsingPOST(options).then((response) => {
      if (response.status === 200) {
        const blob = new Blob([response.data as BlobPart], { type: 'application/octet-stream' });
        const url = globalThis.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'huntly.opml';
        document.body.appendChild(link);
        link.click();

        link.remove();
        globalThis.URL.revokeObjectURL(url);
      }
    }).catch(() => {
      enqueueSnackbar(t('settings:exportFailed'), {
        variant: "error",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    }).finally(() => {
      setExporting(false);
    });
  }

  function handleFileChange(e) {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  }

  const [feedsInfo, setFeedsInfo] = useState<PreviewFeedsInfo>();
  const formikFeeds = useFormik({
    initialValues: {
      subscribeUrl: ''
    },
    validationSchema: yup.object({
      subscribeUrl: yup.string().url(t('settings:invalidUrl')).required(t('settings:rssLinkRequired'))
    }),
    onSubmit: (values) => {
      setFeedsInfo(null);
      api.previewFeedsUsingGET(values.subscribeUrl).then((res) => {
        setFeedsInfo(res.data);
      }).catch(() => {
        enqueueSnackbar(t('settings:previewFailedCheckUrl'), {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      });
    }
  })

  function followFeeds() {
    if (feedsInfo) {
      api.followFeedUsingPOST(feedsInfo?.feedUrl).then(() => {
        enqueueSnackbar(t('settings:feedSubscribed'), {
          variant: "success",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      }).catch(() => {
        enqueueSnackbar(t('settings:feedSubscribeFailed'), {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      });
    }
  }

  return (
    <div>
      <div>
        <SettingSectionTitle
          first
          icon={ScheduleIcon}
        >
          {t('settings:globalSettings')}
        </SettingSectionTitle>
        <form onSubmit={formikDefaultFeedSetting.handleSubmit}>
          <div className="flex flex-wrap items-start gap-3">
            <TextField
              size={'small'}
              margin={'normal'}
              id={'defaultFeedFetchIntervalMinutes'}
              name={'defaultFeedFetchIntervalMinutes'}
              label={t('settings:defaultUpdateInterval')}
              value={formikDefaultFeedSetting.values.defaultFeedFetchIntervalMinutes ?? ''}
              onChange={handleDefaultFeedFetchIntervalChange}
              onBlur={handleDefaultFeedFetchIntervalBlur}
              error={formikDefaultFeedSetting.touched.defaultFeedFetchIntervalMinutes && Boolean(formikDefaultFeedSetting.errors.defaultFeedFetchIntervalMinutes)}
              helperText={formikDefaultFeedSetting.touched.defaultFeedFetchIntervalMinutes && formikDefaultFeedSetting.errors.defaultFeedFetchIntervalMinutes}
              type={'number'}
              variant={'outlined'}
              inputProps={{ min: 1, step: 1 }}
              InputProps={{
                endAdornment: <InputAdornment position="end">{t('settings:minutesUnit')}</InputAdornment>,
              }}
              className="w-full sm:w-[260px]"
              disabled={!globalSetting || formikDefaultFeedSetting.isSubmitting}
            />
          </div>
        </form>
      </div>
      <div>
        <SettingSectionTitle icon={RssFeedIcon}>{t('settings:feeds')}</SettingSectionTitle>
        <form onSubmit={formikFeeds.handleSubmit}>
          <TextField fullWidth={true} size={'small'} margin={'normal'}
            label={t('settings:rssLink')}
            id={'subscribeUrl'} name={'subscribeUrl'}
            value={formikFeeds.values.subscribeUrl}
            onChange={formikFeeds.handleChange}
            error={formikFeeds.touched.subscribeUrl && Boolean(formikFeeds.errors.subscribeUrl)}
            helperText={formikFeeds.touched.subscribeUrl && formikFeeds.errors.subscribeUrl}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button color={'primary'} variant={'contained'} size={'medium'} type={'submit'}>{t('settings:preview')}</Button>
        </form>
        <div>
          {feedsInfo && <Card className={`mt-2 flex mr-4`}>
            {
              feedsInfo.siteFaviconUrl &&
              <div className={'w-[130px] flex items-center shrink-0 justify-center'}
                style={{ backgroundColor: 'rgb(247,249,249)' }}>
                <CardMedia
                  component="img"
                  sx={{ width: 60, height: 60 }}
                  image={feedsInfo.siteFaviconUrl}
                  alt={feedsInfo.title}
                />
              </div>
            }
            {
              !feedsInfo.siteFaviconUrl &&
              <div className={'w-[130px] flex items-center shrink-0'} style={{ backgroundColor: 'rgb(247,249,249)' }}>
                <CardMedia
                  component={RssFeedIcon}
                  className={'grow'}
                />
              </div>
            }
            <div className={'flex items-center grow'}>
              <CardContent sx={{ borderLeft: '1px solid #ccc' }}>
                <Typography variant="body2" color="text.secondary">
                  {feedsInfo.siteLink}
                </Typography>
                <Typography variant="body1" component="div">
                  {feedsInfo.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" className={`line-clamp-2`}>
                  {feedsInfo.description}
                </Typography>
              </CardContent>
            </div>
            <div className={'flex items-center mr-4'}>
              {
                feedsInfo.subscribed &&
                <Button color={'info'} variant={'contained'} size={'medium'} disabled={true}>{t('settings:followingFeed')}</Button>
              }
              {
                !feedsInfo.subscribed &&
                <Button color={'primary'} variant={'contained'} size={'medium'} onClick={followFeeds}>{t('settings:followFeed')}</Button>
              }
            </div>
          </Card>}
        </div>
      </div>
      <div>
        <SettingSectionTitle icon={UploadFileIcon}>{t('settings:opmlImport')}</SettingSectionTitle>
        <div>
          <label htmlFor={'opmlFile'}>{t('settings:chooseFile')}</label>
          <input type={'file'} name={'opmlFile'} onChange={handleFileChange} />
          <Button type={'button'} color={'primary'} size={'small'} variant={'contained'} disabled={importing}
            onClick={uploadOpml}>{importing ? t('settings:importingAction') : t('settings:importAction')}</Button>
        </div>
      </div>
      <div>
        <SettingSectionTitle icon={DownloadIcon}>{t('settings:opmlExport')}</SettingSectionTitle>
        <div>
          <Button type={'button'} color={'primary'} size={'small'} variant={'contained'} disabled={exporting}
            onClick={downloadOpml}>{exporting ? t('settings:exportingAction') : t('settings:exportAction')}</Button>
        </div>
      </div>
      <div>
        <SettingSectionTitle icon={SettingsIcon}>{t('settings:options')}</SettingSectionTitle>
        <div>
          <FormControlLabel
            control={
              <Switch
                checked={markReadOnScroll}
                onChange={handleMarkReadOnScrollChange}
              />
            }
            label={t('settings:markReadOnScroll')}
          />
        </div>
      </div>
    </div>
  );
}

const ListWrapper = styled('div')(({ theme }) => ({
  backgroundColor: 'rgba(248, 250, 252, 0.6)',
  borderRadius: '12px',
  border: '1px solid rgba(226, 232, 240, 0.8)',
}));

function FoldersTabContent() {
  const { t } = useTranslation(['settings', 'common']);
  const api = SettingControllerApiFactory();
  const [folderId, setFolderId] = React.useState<number>(0);
  const [editFolderId, setEditFolderId] = React.useState<number>(null);
  const [editFeedsId, setEditFeedsId] = React.useState<number>(null);
  const [deleteFolderFeedsConfirmOpen, setDeleteFolderFeedsConfirmOpen] = React.useState(false);
  const [deletingFolderFeeds, setDeletingFolderFeeds] = React.useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const {
    data: folders,
    refetch: refetchFolders
  } = useQuery(["sorted_folders"], async () => (await api.getSortedFoldersUsingGET()).data);
  const {
    data: connectors,
    refetch: refetchConnectors
  } = useQuery(["folder_connectors", folderId], async () => (await api.getSortedConnectorsByFolderIdUsingGET(folderId)).data);
  const queryClient = useQueryClient();
  const selectedFolder = folders?.find((folder) => (folder.id || 0) === folderId);
  const folderFeedsCount = connectors?.length || 0;
  const canDeleteFolderFeeds = Boolean(selectedFolder) && folderFeedsCount > 0;

  function connectorDragEnd({ source, destination }: DropResult) {
    if (!destination || !source || destination.index === source.index) {
      return;
    }
    const reorderConnectors = reorder(connectors, source.index, destination.index);
    queryClient.setQueryData(["folder_connectors", folderId], reorderConnectors);
    api.resortConnectorsUsingPOST(reorderConnectors.map((c) => c.id)).then(() => {
      enqueueSnackbar(t('settings:feedsOrderChanged'), {
        variant: "success",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    }).catch(() => {
      enqueueSnackbar(t('settings:feedsOrderChangeFailed'), {
        variant: "error",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    });
  }

  function folderDragEnd({ source, destination }: DropResult) {
    if (!destination || destination.index === 0 || !source || destination.index === source.index) {
      return;
    }
    const reorderFolders = reorder(folders, source.index, destination.index);
    queryClient.setQueryData(["sorted_folders"], reorderFolders);
    api.resortFoldersUsingPOST(reorderFolders.map((c) => c.id)).then(() => {
      enqueueSnackbar(t('settings:foldersOrderChanged'), {
        variant: "success",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    }).catch(() => {
      enqueueSnackbar(t('settings:foldersOrderChangeFailed'), {
        variant: "error",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    });
  }

  async function handleDeleteFolderFeeds() {
    if (!selectedFolder) {
      setDeleteFolderFeedsConfirmOpen(false);
      return;
    }

    const targetFolderName = selectedFolder.name || t('settings:noFolder');
    const deletableConnectors = (connectors || []).filter((connector) => connector.id != null);

    setDeleteFolderFeedsConfirmOpen(false);

    if (deletableConnectors.length === 0) {
      return;
    }

    setDeletingFolderFeeds(true);

    try {
      const results = await Promise.allSettled(
        deletableConnectors.map((connector) => api.deleteFeedUsingPOST(connector.id))
      );
      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedCount = results.length - successCount;

      if (failedCount === 0) {
        enqueueSnackbar(t('settings:folderFeedsDeleted', {
          count: successCount,
          name: targetFolderName
        }), {
          variant: "success",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      } else if (successCount > 0) {
        enqueueSnackbar(t('settings:folderFeedsPartiallyDeleted', {
          successCount,
          failedCount,
          name: targetFolderName
        }), {
          variant: "warning",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      } else {
        enqueueSnackbar(t('settings:folderFeedsDeleteFailed', {
          name: targetFolderName
        }), {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      }
    } finally {
      await Promise.all([refetchConnectors(), refetchFolders()]);
      setDeletingFolderFeeds(false);
    }
  }

  return (
    <div className={'pb-4'}>
      <div className={'flex'}>
        <div className="w-1/2 pr-4">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200 min-h-[40px]">
            <Typography variant="subtitle1" component="h4" className="font-semibold text-gray-700">
              {t('settings:folder')}
            </Typography>
            <Button variant="outlined" startIcon={<CreateNewFolderIcon />} onClick={() => {
              setEditFolderId(0);
            }} size="small">
              {t('settings:addFolder')}
            </Button>
          </div>
          {
            folders && <DragDropContext onDragEnd={folderDragEnd}>
              <Droppable droppableId={'droppable-folder-list'}>
                {provided => (
                  <ListWrapper ref={provided.innerRef} {...provided.droppableProps}>
                    <List sx={{ p: 0, position: 'static' }}>
                      {
                        folders.map((folder, index) =>
                          <Draggable key={'folder-' + (folder.id)} draggableId={(folder.id || 0).toString()}
                            index={index} isDragDisabled={folder.id === null || folder.id === 0}>
                            {
                              (dragProvided, snapshot) => {
                                const draggable = (
                                  <Box
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    key={folder.id}
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      p: 1,
                                      ...(snapshot.isDragging && {
                                        background: 'white',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                      }),
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        flexGrow: 1,
                                        cursor: 'pointer',
                                        borderRadius: 1,
                                        ...(folder.id || 0) === folderId && {
                                          backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                        },
                                      }}
                                      onClick={() => {
                                        setFolderId(folder.id || 0)
                                      }}
                                    >
                                      <ListItemAvatar>
                                        <Avatar>
                                          <FolderIcon />
                                        </Avatar>
                                      </ListItemAvatar>
                                      <ListItemText
                                        primary={folder.name}
                                        secondary={!folder.id && t('settings:noFolder')}
                                      />
                                    </Box>
                                    <IconButton edge="end" aria-label={t('common:edit')} disabled={!folder.id} onClick={() => {
                                      setEditFolderId(folder.id)
                                    }}>
                                      <EditIcon />
                                    </IconButton>
                                  </Box>
                                );

                                return snapshot.isDragging ? createPortal(draggable, document.body) : draggable;
                              }
                            }
                          </Draggable>)
                      }
                      {provided.placeholder}
                    </List>
                  </ListWrapper>
                )}
              </Droppable>
            </DragDropContext>
          }
        </div>
        <div className="w-1/2 pl-4">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200 min-h-[40px]">
            <Typography variant="subtitle1" component="h4" className="font-semibold text-gray-700">
              {t('settings:feeds')}
            </Typography>
          </div>
          {
            connectors && connectors.length > 0 && <DragDropContext onDragEnd={connectorDragEnd}>
              <Droppable droppableId={'droppable-feeds-list'}>
                {provided => (
                  <ListWrapper ref={provided.innerRef} {...provided.droppableProps}>
                    <List sx={{ p: 0, position: 'static' }}>
                      {
                        connectors.map((conn, index) =>
                          <Draggable key={conn.id} draggableId={conn.id.toString()} index={index}>
                            {
                              (dragProvided, snapshot) => {
                                const draggable = (
                                  <Box
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    key={conn.id}
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      p: 1,
                                      ...(snapshot.isDragging && {
                                        background: 'white',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                      }),
                                    }}
                                  >
                                    <ListItemAvatar>
                                      <Avatar>
                                        {
                                          conn.iconUrl &&
                                          <img src={conn.iconUrl} alt={conn.name} className={'w-[24px] h-[24px]'} />
                                        }
                                        {
                                          !conn.iconUrl && <RssFeedIcon />
                                        }
                                      </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                      primary={conn.name}
                                      sx={{ color: conn.enabled ? '#000' : '#999' }}
                                    />
                                    <IconButton edge="end" aria-label={t('common:edit')} onClick={() => {
                                      setEditFeedsId(conn.id)
                                    }}>
                                      <EditIcon />
                                    </IconButton>
                                  </Box>
                                );

                                return snapshot.isDragging ? createPortal(draggable, document.body) : draggable;
                              }
                            }
                          </Draggable>)
                      }
                      {provided.placeholder}
                    </List>
                  </ListWrapper>
                )}
              </Droppable>
            </DragDropContext>
          }
          {
            canDeleteFolderFeeds && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  color="warning"
                  startIcon={<DeleteSweepIcon />}
                  onClick={() => setDeleteFolderFeedsConfirmOpen(true)}
                  disabled={deletingFolderFeeds || folderFeedsCount === 0}
                >
                  {t('settings:deleteFolderFeeds')}
                </Button>
              </Box>
            )
          }
        </div>
      </div>

      {
        editFolderId != null && <FolderFormDialog folderId={editFolderId} onClose={() => {
          setEditFolderId(null);
          refetchFolders();
        }} />
      }
      {
        editFeedsId != null && <FeedsFormDialog feedsId={editFeedsId} onClose={() => {
          setEditFeedsId(null);
          refetchConnectors();
        }} />
      }
      <DeleteConfirmDialog
        open={deleteFolderFeedsConfirmOpen}
        title={t('settings:deleteFolderFeeds')}
        content={t('settings:deleteFolderFeedsConfirmDesc', {
          count: folderFeedsCount,
          name: selectedFolder?.name || t('settings:noFolder')
        })}
        onConfirm={handleDeleteFolderFeeds}
        onCancel={() => setDeleteFolderFeedsConfirmOpen(false)}
      />
    </div>
  );
}
