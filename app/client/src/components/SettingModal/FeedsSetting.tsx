import Typography from "@mui/material/Typography";
import {
  Avatar,
  Box,
  Button,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
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
import { styled } from "@mui/material/styles";
import FolderFormDialog from "./FolderFormDialog";
import FeedsFormDialog from "./FeedsFormDialog";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { reorder } from "../../common/arrayUtils";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
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
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <div>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="feeds settings tabs">
          <Tab icon={<RssFeedIcon />} iconPosition="start" label="Feeds" {...a11yProps(0)} sx={{ minHeight: 48 }} />
          <Tab icon={<FolderIcon />} iconPosition="start" label="Folders" {...a11yProps(1)} sx={{ minHeight: 48 }} />
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
  const [file, setFile] = useState<File>();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const api = SettingControllerApiFactory();
  const { markReadOnScroll, setMarkReadOnScroll } = useGlobalSettings();

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

      enqueueSnackbar('Setting saved.', {
        variant: "success",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    } catch (err) {
      // Revert on error
      setMarkReadOnScroll(!newValue);
      enqueueSnackbar('Failed to save setting. Error: ' + err, {
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
      enqueueSnackbar('Import success.', {
        variant: "success",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    }).catch((err) => {
      enqueueSnackbar('Import failed. Error: ' + err, {
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
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'huntly.opml';
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    }).catch((err) => {
      enqueueSnackbar('export failed. Error: ' + err, {
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
      subscribeUrl: yup.string().required('RSS link is required.')
    }),
    onSubmit: (values) => {
      setFeedsInfo(null);
      api.previewFeedsUsingGET(values.subscribeUrl).then((res) => {
        setFeedsInfo(res.data);
      }).catch((err) => {
        enqueueSnackbar('Preview failed. Error: ' + err, {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      });
    }
  })

  function followFeeds() {
    if (feedsInfo) {
      api.followFeedUsingPOST(feedsInfo?.feedUrl).then(() => {
        enqueueSnackbar('Follow success.', {
          variant: "success",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      }).catch((err) => {
        enqueueSnackbar('Follow failed. Error: ' + err, {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      });
    }
  }

  return (
    <div>
      <div>
        <SettingSectionTitle first icon={RssFeedIcon}>Subscribe to RSS</SettingSectionTitle>
        <form onSubmit={formikFeeds.handleSubmit}>
          <TextField fullWidth={true} size={'small'} margin={'normal'}
            label={'RSS link'}
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
          <Button color={'primary'} variant={'contained'} size={'medium'} type={'submit'}>Preview</Button>
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
                <Button color={'info'} variant={'contained'} size={'medium'} disabled={true}>following</Button>
              }
              {
                !feedsInfo.subscribed &&
                <Button color={'primary'} variant={'contained'} size={'medium'} onClick={followFeeds}>follow</Button>
              }
            </div>
          </Card>}
        </div>
      </div>
      <div>
        <SettingSectionTitle icon={UploadFileIcon}>OPML Import</SettingSectionTitle>
        <div>
          <label htmlFor={'opmlFile'}>Choose file: </label>
          <input type={'file'} name={'opmlFile'} onChange={handleFileChange} />
          <Button type={'button'} color={'primary'} size={'small'} variant={'contained'} disabled={importing}
            onClick={uploadOpml}>{importing ? 'importing' : 'import'}</Button>
        </div>
      </div>
      <div>
        <SettingSectionTitle icon={DownloadIcon}>OPML Export</SettingSectionTitle>
        <div>
          <Button type={'button'} color={'primary'} size={'small'} variant={'contained'} disabled={exporting}
            onClick={downloadOpml}>{exporting ? 'exporting' : 'export'}</Button>
        </div>
      </div>
      <div>
        <SettingSectionTitle icon={SettingsIcon}>Options</SettingSectionTitle>
        <div>
          <FormControlLabel
            control={
              <Switch
                checked={markReadOnScroll}
                onChange={handleMarkReadOnScrollChange}
              />
            }
            label="Mark read when you scroll past them"
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
  const api = SettingControllerApiFactory();
  const [folderId, setFolderId] = React.useState<number>(0);
  const [editFolderId, setEditFolderId] = React.useState<number>(null);
  const [editFeedsId, setEditFeedsId] = React.useState<number>(null);
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

  function connectorDragEnd({ source, destination }: DropResult) {
    if (!destination || !source || destination.index === source.index) {
      return;
    }
    const reorderConnectors = reorder(connectors, source.index, destination.index);
    queryClient.setQueryData(["folder_connectors", folderId], reorderConnectors);
    api.resortConnectorsUsingPOST(reorderConnectors.map((c) => c.id)).then(() => {
      enqueueSnackbar('Feeds display sequence changed.', {
        variant: "success",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    }).catch((err) => {
      enqueueSnackbar('Feeds display sequence change failed. Error: ' + err, {
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
      enqueueSnackbar('Folders display sequence changed.', {
        variant: "success",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    }).catch((err) => {
      enqueueSnackbar('Folders display sequence change failed. Error: ' + err, {
        variant: "error",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    });
  }

  return (
    <div className={'pb-4'}>
      <div className={'flex'}>
        <div className="w-1/2 pr-4">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200 min-h-[40px]">
            <Typography variant="subtitle1" component="h4" className="font-semibold text-gray-700">
              Folders
            </Typography>
            <Button variant="outlined" startIcon={<CreateNewFolderIcon />} onClick={() => {
              setEditFolderId(0);
            }} size="small">
              New Folder
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
                                        secondary={!folder.id && 'Root Folder'}
                                      />
                                    </Box>
                                    <IconButton edge="end" aria-label="edit" disabled={!folder.id} onClick={() => {
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
              Feeds
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
                                    <IconButton edge="end" aria-label="edit" onClick={() => {
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
    </div>
  );
}
