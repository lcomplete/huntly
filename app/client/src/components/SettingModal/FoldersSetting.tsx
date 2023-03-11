import Typography from "@mui/material/Typography";
import {
  Avatar, Button,
  IconButton,
  List,
  ListItem,
  ListItemAvatar, ListItemButton, ListItemText
} from "@mui/material";
import React from "react";
import {SettingControllerApiFactory} from "../../api";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import EditIcon from '@mui/icons-material/Edit';
import FolderIcon from '@mui/icons-material/Folder';
import RssFeedIcon from "@mui/icons-material/RssFeed";
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import {styled} from "@mui/material/styles";
import FolderFormDialog from "./FolderFormDialog";
import FeedsFormDialog from "./FeedsFormDialog";
import {DragDropContext, Droppable, Draggable, DropResult} from 'react-beautiful-dnd';
import {reorder} from "../../common/arrayUtils";
import {useSnackbar} from "notistack";

export default function FoldersSetting() {
  const api = SettingControllerApiFactory();
  const [folderId, setFolderId] = React.useState<number>(0);
  const [editFolderId, setEditFolderId] = React.useState<number>(null);
  const [editFeedsId, setEditFeedsId] = React.useState<number>(null);
  const {enqueueSnackbar} = useSnackbar();
  const {
    data: folders,
    refetch: refetchFolders
  } = useQuery(["sorted_folders"], async () => (await api.getSortedFoldersUsingGET()).data);
  const {
    data: connectors,
    refetch: refetchConnectors
  } = useQuery(["folder_connectors", folderId], async () => (await api.getSortedConnectorsByFolderIdUsingGET(folderId)).data);
  const ListWrapper = styled('div')(({theme}) => ({
    backgroundColor: '#f0f0f0',
  }));
  const queryClient = useQueryClient();

  function connectorDragEnd({source, destination}: DropResult) {
    if (!destination || !source || destination.index === source.index) {
      return;
    }
    const reorderConnectors = reorder(connectors, source.index, destination.index);
    queryClient.setQueryData(["folder_connectors", folderId], reorderConnectors);
    api.resortConnectorsUsingPOST(reorderConnectors.map((c) => c.id)).then(() => {
      enqueueSnackbar('Feeds display sequence changed.', {
        variant: "success",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    }).catch((err) => {
      enqueueSnackbar('Feeds display sequence change failed. Error: ' + err, {
        variant: "error",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    });
  }

  function folderDragEnd({source, destination}: DropResult) {
    if (!destination || destination.index===0 || !source || destination.index === source.index) {
      return;
    }
    const reorderFolders = reorder(folders, source.index, destination.index);
    queryClient.setQueryData(["sorted_folders"], reorderFolders);
    api.resortFoldersUsingPOST(reorderFolders.map((c) => c.id)).then(() => {
      enqueueSnackbar('Folders display sequence changed.', {
        variant: "success",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    }).catch((err) => {
      enqueueSnackbar('Folders display sequence change failed. Error: ' + err, {
        variant: "error",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    });
  }

  return <div className={'pb-4'}>
    {/*<Typography variant={'h6'}>Folders</Typography>*/}
    {/*<Divider/>*/}
    <div className={'flex'}>
      <div className={'w-1/2'}>
        <div>
          <Typography sx={{mt: 0, mb: 2, pl: 1}} variant="h6" component="div"
                      className={'flex justify-between items-center'}>
            Folders
            <Button variant={'outlined'} startIcon={<CreateNewFolderIcon/>} onClick={() => {
              setEditFolderId(0);
            }} size={"small"}>
              New Folder
            </Button>
          </Typography>
        </div>
        {
          folders && <ListWrapper>
                <List>
                    <DragDropContext onDragEnd={folderDragEnd}>
                        <Droppable droppableId={'droppable-folder-list'}>
                          {provided => <div ref={provided.innerRef} {...provided.droppableProps}>
                            {
                              folders.map((folder, index) =>
                                <Draggable key={'folder-' + (folder.id)} draggableId={(folder.id || 0).toString()}
                                           index={index} isDragDisabled={folder.id === null || folder.id === 0}>
                                  {
                                    (dragProvided, snapshot) => (
                                      <ListItem
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...dragProvided.dragHandleProps}
                                        className={snapshot.isDragging ? 'bg-white' : ''}
                                        key={folder.id}
                                        secondaryAction={
                                          <IconButton edge="end" aria-label="edit" disabled={!folder.id} onClick={() => {
                                            setEditFolderId(folder.id)
                                          }}>
                                            <EditIcon/>
                                          </IconButton>
                                        }
                                        sx={{p: 0}}
                                      >
                                        <ListItemButton selected={(folder.id || 0) === folderId} sx={{p: 1}}
                                                        onClick={() => {
                                                          setFolderId(folder.id || 0)
                                                        }}>
                                          <ListItemAvatar>
                                            <Avatar>
                                              <FolderIcon/>
                                            </Avatar>
                                          </ListItemAvatar>
                                          <ListItemText
                                            primary={folder.name}
                                            secondary={!folder.id && 'Root Folder'}
                                          />
                                        </ListItemButton>
                                      </ListItem>
                                    )
                                  }
                                </Draggable>)
                            }
                          </div>
                          }
                        </Droppable>
                    </DragDropContext>
                </List>
            </ListWrapper>
        }
      </div>
      <div className={'grow ml-2'}>
        <Typography sx={{mt: 0, mb: 2, pl: 1}} variant="h6" component="div">
          Feeds
        </Typography>
        {
          connectors && connectors.length > 0 && <ListWrapper>
                <List>
                    <DragDropContext onDragEnd={connectorDragEnd}>
                        <Droppable droppableId={'droppable-feeds-list'}>
                          {provided => <div ref={provided.innerRef} {...provided.droppableProps}>
                            {
                              connectors.map((conn, index) =>
                                <Draggable key={conn.id} draggableId={conn.id.toString()} index={index}>
                                  {
                                    (dragProvided, snapshot) => (
                                      <ListItem
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...dragProvided.dragHandleProps}
                                        className={snapshot.isDragging ? 'bg-white' : ''}
                                        key={conn.id}
                                        secondaryAction={
                                          <React.Fragment>
                                            <IconButton edge="end" aria-label="edit" onClick={() => {
                                              setEditFeedsId(conn.id)
                                            }}>
                                              <EditIcon/>
                                            </IconButton>
                                          </React.Fragment>
                                        }
                                      >
                                        <ListItemAvatar>
                                          <Avatar>
                                            {
                                              conn.iconUrl &&
                                                <img src={conn.iconUrl} alt={conn.name} className={'w-[24px] h-[24px]'}/>
                                            }
                                            {
                                              !conn.iconUrl && <RssFeedIcon/>
                                            }
                                          </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                          primary={conn.name}
                                          sx={{color: conn.enabled ? '#000' : '#999'}}
                                        />
                                      </ListItem>
                                    )
                                  }
                                </Draggable>)
                            }
                            {provided.placeholder}
                          </div>
                          }
                        </Droppable>
                    </DragDropContext>
                </List>
            </ListWrapper>
        }
      </div>
    </div>

    {
      editFolderId != null && <FolderFormDialog folderId={editFolderId} onClose={() => {
        setEditFolderId(null);
        refetchFolders();
      }}/>
    }
    {
      editFeedsId != null && <FeedsFormDialog feedsId={editFeedsId} onClose={() => {
        setEditFeedsId(null);
        refetchConnectors();
      }}/>
    }
  </div>;
}