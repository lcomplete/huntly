import React, {useEffect, useState} from "react";
import ReactDOM from "react-dom";
import './popup.css';
import EnergySavingsLeafIcon from "@mui/icons-material/EnergySavingsLeaf";
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Alert,
  Button,
  Card,
  CardActionArea, CardContent,
  CardMedia,
  CircularProgress,
  IconButton,
  TextField,
  Tooltip, Typography
} from "@mui/material";
import {readSyncStorageSettings, StorageSettings} from "./storage";
import {Options} from "./options";
import {combineUrl, getData} from "./utils";
import PersonPinIcon from '@mui/icons-material/PersonPin';
import ArticleIcon from '@mui/icons-material/Article';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import StarBorderIcon from "@mui/icons-material/StarBorder";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';

const Popup = () => {
  const [storageSettings, setStorageSettings] = useState<StorageSettings>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [username, setUsername] = useState<string>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [page, setPage] = useState<PageModel>(null);
  const [savedPageId, setSavedPageId] = useState<number>(0);

  useEffect(() => {
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
      const tab = tabs[0];
      if (tab) {
        chrome.tabs.sendMessage(tab.id, {type: 'parse_doc'}, function (response) {
          setPage(response.page);
          setSavedPageId(response.savedPageId)
        });
      }
    });
  }, []);

  useEffect(() => {
    readSyncStorageSettings().then((settings) => {
      setSettingsState(settings);
    });
  }, []);

  function setSettingsState(settings: StorageSettings) {
    setStorageSettings(settings);
    if (!settings.serverUrl) {
      setShowOptions(true);
    } else {
      setLoadingUser(true);
      getData(settings.serverUrl, "api/auth/loginUserInfo").then((data) => {
        const result = JSON.parse(data);
        setUsername(result.username);
      }).catch(() => {
        setUsername(null);
      }).finally(() => {
        setLoadingUser(false);
      });
    }
  }

  function toggleShowOptions() {
    setShowOptions(!showOptions);
    // chrome.runtime.openOptionsPage();
  }

  function getDomain(serverUrl: string) {
    const url = new URL(serverUrl);
    return url.hostname;
  }

  function handleOptionsChange(settings: StorageSettings) {
    setShowOptions(false);
    setSettingsState(settings);
  }

  function openSignIn() {
    chrome.tabs.create({url: combineUrl(storageSettings.serverUrl, "/signin")});
  }

  function openHuntly() {
    chrome.tabs.create({url: storageSettings.serverUrl});
  }

  return (
    <div style={{minWidth: "600px", minHeight: '200px'}} className={'mb-4'}>
      <div className={'commonPadding header'}>
        <div className="flex items-center text-sky-600 font-bold">
          <EnergySavingsLeafIcon className="h-4 w-4 mr-1"/>
          Huntly
          {
            storageSettings && storageSettings.serverUrl && <div>
                  <a className={'ml-1 text-sm text-sky-500 no-underline hover:underline'} href={storageSettings.serverUrl}
                     target={"_blank"}>{getDomain(storageSettings.serverUrl)} &gt;</a>
              </div>
          }
        </div>
        <div className={'flex items-center'}>
          {
            !loadingUser && username && <Tooltip title={'You are signed in.'} placement={'bottom'}>
                  <IconButton onClick={openHuntly}>
                      <PersonPinIcon className={'text-sky-600'}/>
                  </IconButton>
              </Tooltip>
          }
          <IconButton onClick={toggleShowOptions}>
            <SettingsOutlinedIcon className={'text-sky-600'}/>
          </IconButton>
        </div>
      </div>

      <div className={'commonPadding'}>
        {
          !storageSettings || !storageSettings.serverUrl && <div className={'mb-2'}>
                <Alert severity={'info'}>Please set the huntly server url first.</Alert>
            </div>
        }
        {
          showOptions && <div className={'flex justify-center'}>
                <Options onOptionsChange={handleOptionsChange}></Options>
            </div>
        }
        {
          !showOptions && <div>
            {
              loadingUser && <div className={'flex justify-center items-center h-[120px]'}>
                    <CircularProgress/>
                </div>
            }
            {
              !loadingUser && !username && <div>
                    <div className={'mt-5'}>
                        <Alert severity={'info'}>Please sign in to start.</Alert>
                    </div>
                    <div className={'mt-5 mb-10'}>
                        <Button fullWidth={true} color={"primary"} variant={'contained'} onClick={openSignIn}>Sign In</Button>
                    </div>
                </div>
            }
            {
              !loadingUser && username && <div>
                {page && <div>
                  {
                    savedPageId > 0 && <div className={'mb-2'}>
                          <Alert severity={'success'}>This webpage has been automatically hunted.
                              <a href={combineUrl(storageSettings.serverUrl, "/page/" + savedPageId)} target={'_blank'}
                                 className={'ml-1'}>view</a>
                          </Alert>
                      </div>
                  }
                    <div>
                        <TextField value={page.url} size={"small"} fullWidth={true} disabled={true}/>
                        <Card className={`mainBorder mt-2 w-full flex`}>
                          {
                            page.thumbUrl &&
                              <div className={'w-[130px] flex items-center shrink-0'}
                                   style={{backgroundColor: 'rgb(247,249,249)'}}>
                                  <CardMedia
                                      component="img"
                                      height={130}
                                      image={page.thumbUrl}
                                      alt={page.title}
                                  />
                              </div>
                          }
                          {
                            !page.thumbUrl &&
                              <div className={'w-[130px] flex items-center shrink-0'}
                                   style={{backgroundColor: 'rgb(247,249,249)'}}>
                                  <CardMedia
                                      component={ArticleIcon}
                                      className={'grow'}
                                  />
                              </div>
                          }
                            <div className={'flex items-center'}>
                                <CardContent sx={{borderLeft: '1px solid #ccc'}}>
                                    <Typography variant="body2" color="text.secondary">
                                      {page.domain}
                                    </Typography>
                                    <Typography variant="body1" component="div">
                                      {page.title}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" className={`line-clamp-2`}>
                                      {page.description}
                                    </Typography>
                                </CardContent>
                            </div>
                        </Card>
                        <div className={'mt-4 flex justify-between'}>
                            <Button variant={'outlined'} size={"small"} endIcon={<PlaylistAddOutlinedIcon/>}>
                                My List
                            </Button>
                            <Button variant={'outlined'} size={"small"} endIcon={<BookmarkBorderIcon/>}>
                                Read Later
                            </Button>
                            <Button variant={'outlined'} size={"small"} endIcon={<StarBorderIcon/>}>
                                Starred
                            </Button>
                          {
                            !savedPageId ? <Button variant="outlined" size={"small"} endIcon={<SendIcon/>}>
                              Send To Huntly
                            </Button> : <Button variant="outlined" size={"small"} startIcon={<DeleteIcon/>}>
                              Delete
                            </Button>
                          }
                        </div>
                    </div>
                </div>
                }
                {
                  !page && <div>
                        <Alert severity={'warning'}>
                            This webpage doesn't look like an article page.
                        </Alert>
                    </div>
                }
                </div>
            }
            </div>
        }
      </div>
    </div>
  );
};

ReactDOM.render(
  <Popup/>,
  document.getElementById("root")
);
