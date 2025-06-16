import React, {useEffect, useState} from "react";
import { createRoot } from 'react-dom/client';
import './popup.css';
import EnergySavingsLeafIcon from "@mui/icons-material/EnergySavingsLeaf";
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress, CssBaseline, Dialog, DialogActions, DialogTitle,
  IconButton, Menu, MenuItem, StyledEngineProvider,
  TextField,
  Tooltip, Typography
} from "@mui/material";
import {readSyncStorageSettings, StorageSettings} from "./storage";
import {combineUrl} from "./utils";
import PersonPinIcon from '@mui/icons-material/PersonPin';
import ArticleIcon from '@mui/icons-material/Article';
import SendIcon from '@mui/icons-material/Send';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import StarBorderIcon from "@mui/icons-material/StarBorder";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import PlaylistAddCheckOutlinedIcon from '@mui/icons-material/PlaylistAddCheckOutlined';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import StarIcon from '@mui/icons-material/Star';
import ArchiveIcon from '@mui/icons-material/Archive';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import {log} from "./logger";
import {
  archivePage,
  deletePage,
  getLoginUserInfo,
  getPageOperateResult,
  processContentWithShortcut,
  readLaterPage, removePageFromLibrary,
  saveArticle, savePageToLibrary, starPage,
  unReadLaterPage,
  unStarPage,
  fetchEnabledShortcuts
} from "./services";
import {LibrarySaveStatus} from "./model/librarySaveStatus";
import {PageOperateResult} from "./model/pageOperateResult";
import {Settings} from "./settings";

const Popup = () => {
    const [storageSettings, setStorageSettings] = useState<StorageSettings>(null);
    const [showOptions, setShowOptions] = useState(false);
    const [username, setUsername] = useState<string>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [page, setPage] = useState<PageModel>(null);
    const [autoSavedPageId, setAutoSavedPageId] = useState<number>(0);
    const [pageOperateResult, setPageOperateResult] = useState<PageOperateResult>(null);
    
    // 快捷指令相关状态
    const [shortcuts, setShortcuts] = useState<any[]>([]);
    const [loadingShortcuts, setLoadingShortcuts] = useState(false);
    const [processingShortcut, setProcessingShortcut] = useState(false);
    const [shortcutMenuAnchorEl, setShortcutMenuAnchorEl] = useState<null | HTMLElement>(null);
    const shortcutMenuOpen = Boolean(shortcutMenuAnchorEl);

    useEffect(() => {
      chrome.runtime.onMessage.addListener(function (msg: Message, sender, sendResponse) {
        log(msg)
        if (msg.type === "save_clipper_success") {
          setAutoSavedPageId(msg.payload["id"]);
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
        getLoginUserInfo().then((data) => {
          const result = JSON.parse(data);
          setUsername(result.username);

          loadPageInfo();
          // 加载快捷指令
          fetchShortcuts();
        }).catch(() => {
          setUsername(null);
        }).finally(() => {
          setLoadingUser(false);
        });
      }
    }

    function loadPageInfo() {
      chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        const tab = tabs[0];
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {type: 'parse_doc'}, function (response) {
            if(response) {
              setPage(response.page);
              loadPageOperateResult(autoSavedPageId, response.page.url);
            }
          });
        }
      });
    }

    function loadPageOperateResult(pageId, url) {
      getPageOperateResult(pageId, url).then((result) => {
        if (result) {
          const operateResult = JSON.parse(result);
          setPageOperateResult(operateResult);
        }
      });
    }

    function toggleShowOptions() {
      setShowOptions(!showOptions);
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

    async function sendToHuntly() {
      const pageId = await savePage(page);
      if (pageId > 0) {
        loadPageOperateResult(pageId, page.url);
      }
    }

    async function savePage(page): Promise<number> {
      const resp = await saveArticle(page);
      if (resp) {
        const json = JSON.parse(resp);
        if (json.data) {
          return json.data;
        }
      }
      return 0;
    }

    async function ensureSavePage(page): Promise<number> {
      if (pageOperateResult?.id > 0) {
        return pageOperateResult.id;
      }
      return savePage(page);
    }

    async function unReadLater() {
      const pageId = await ensureSavePage(page);
      const operateResult = await unReadLaterPage(pageId);
      setPageOperateResult(operateResult);
    }

    async function readLater() {
      const pageId = await ensureSavePage(page);
      const operateResult = await readLaterPage(pageId);
      setPageOperateResult(operateResult);
    }

    async function unStar() {
      const pageId = await ensureSavePage(page);
      const operateResult = await unStarPage(pageId);
      setPageOperateResult(operateResult);
    }

    async function star() {
      const pageId = await ensureSavePage(page);
      const operateResult = await starPage(pageId);
      setPageOperateResult(operateResult);
    }

    async function saveToLibrary() {
      const pageId = await ensureSavePage(page);
      const operateResult = await savePageToLibrary(pageId);
      setPageOperateResult(operateResult);
    }

    async function removeFromLibrary() {
      const pageId = await ensureSavePage(page);
      const operateResult = await removePageFromLibrary(pageId);
      setPageOperateResult(operateResult);
    }

    async function archive() {
      const pageId = await ensureSavePage(page);
      const operateResult = await archivePage(pageId);
      setPageOperateResult(operateResult);
    }

    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

    async function deletePageData() {
      if (pageOperateResult?.id > 0) {
        await deletePage(pageOperateResult.id);
        setPageOperateResult(null);
        handleCloseDeleteDialog();
      }
    }

    function handleCloseDeleteDialog() {
      setOpenDeleteDialog(false);
    }

    function showDeleteDialog() {
      setOpenDeleteDialog(true);
    }

    function groupSaveAction(mainIcon, mainAction, mainTooltip, secondaryIcon, secondaryAction, secondaryTooltip) {
      return <div className={"float-right group"}>
        <Tooltip title={mainTooltip} placement={"right"}>
          <IconButton onClick={mainAction} className={"group-hover:shadow-heavy group-hover:bg-white"}>
            {mainIcon}
          </IconButton>
        </Tooltip>
        <div className={"group-hover:flex hidden absolute flex-col"}>
          <Tooltip title={secondaryTooltip} placement={"right"}>
            <IconButton onClick={secondaryAction} className={"mt-2 bg-white shadow-heavy hover:bg-white"}>
              {secondaryIcon}
            </IconButton>
          </Tooltip>
          {
            pageOperateResult?.id ? <Tooltip title={"Delete forever"} placement={"right"}>
              <IconButton onClick={showDeleteDialog} className={"mt-2 bg-white shadow-heavy hover:bg-white"}
                          color={"error"}>
                <DeleteForeverIcon fontSize={"small"}/>
              </IconButton>
            </Tooltip> : <Tooltip title={"Send to huntly"} placement={"right"}>
              <IconButton onClick={sendToHuntly} className={"mt-2 bg-white shadow-heavy hover:bg-white"}
              >
                <SendIcon fontSize={"small"}/>
              </IconButton>
            </Tooltip>
          }
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
              <Button onClick={deletePageData} autoFocus color={'warning'}>
                Delete
              </Button>
            </DialogActions>
          </Dialog>
        </div>
      </div>;
    }

    function articlePreview() {
      chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        const tab = tabs[0];
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {type: 'article_preview'}, function (response) {
          });
        }
      });
    }

    // 获取可用的快捷指令
    async function fetchShortcuts() {
      try {
        setLoadingShortcuts(true);
        const data = await fetchEnabledShortcuts();
        setShortcuts(data);
      } catch (error) {
        console.error("Error fetching shortcuts:", error);
      } finally {
        setLoadingShortcuts(false);
      }
    }

    // 处理快捷指令菜单打开
    const handleShortcutMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
      setShortcutMenuAnchorEl(event.currentTarget);
    };
    
    // 处理快捷指令菜单关闭
    const handleShortcutMenuClose = () => {
      setShortcutMenuAnchorEl(null);
    };
    
    // 处理快捷指令点击
    const handleShortcutClick = async (shortcutId: number, shortcutName: string) => {
      if (!page || processingShortcut) return;
      
      setProcessingShortcut(true);
      handleShortcutMenuClose();
      
      try {
        // 获取当前活动标签页
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
          const tab = tabs[0];
          if (tab) {
            // 发送消息到 background 脚本处理快捷指令
            chrome.runtime.sendMessage({
              type: 'process_shortcut',
              payload: {
                tabId: tab.id,
                shortcutId,
                shortcutName,
                content: page.content,
                url: page.url
              }
            });
            
            // 关闭 popup 窗口
            window.close();
          }
        });
      } catch (error) {
        console.error("Error processing with shortcut:", error);
        setProcessingShortcut(false);
      }
    };

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
              <Settings onOptionsChange={handleOptionsChange}></Settings>
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
                      autoSavedPageId > 0 && <div className={'mb-2'}>
                        <Alert severity={'success'}>This webpage has been automatically hunted.
                          <a href={combineUrl(storageSettings.serverUrl, "/page/" + autoSavedPageId)} target={'_blank'}
                             className={'ml-1'}>view</a>
                        </Alert>
                      </div>
                    }
                    {
                      !autoSavedPageId && pageOperateResult && pageOperateResult.id > 0 && <div className={'mb-2'}>
                        <Alert severity={'info'}>This webpage has been hunted.
                          <a href={combineUrl(storageSettings.serverUrl, "/page/" + pageOperateResult.id)} target={'_blank'}
                             className={'ml-1'}>view</a>
                        </Alert>
                      </div>
                    }
                    <div>
                      <div className={'flex items-center'}>
                        <TextField value={page.url} size={"small"} fullWidth={true} disabled={true}/>
                        <div className={'grow shrink-0 pl-2'}>
                          {
                            pageOperateResult?.readLater ? (
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
                            pageOperateResult?.starred ? (
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
                            pageOperateResult?.librarySaveStatus === LibrarySaveStatus.Archived ? (
                              groupSaveAction(
                                <ArchiveIcon fontSize={'small'}/>, saveToLibrary, 'Remove from archive',
                                <PlaylistAddCheckOutlinedIcon fontSize={'small'}/>, removeFromLibrary, 'Remove from my list')
                            ) : pageOperateResult?.librarySaveStatus === LibrarySaveStatus.Saved ? (
                              groupSaveAction(
                                <PlaylistAddCheckOutlinedIcon fontSize={'small'}/>, removeFromLibrary, 'Remove from my list',
                                <ArchiveOutlinedIcon fontSize={'small'}/>, archive, 'Archive'
                              )
                            ) : (
                              groupSaveAction(
                                <PlaylistAddOutlinedIcon fontSize={"small"}/>, saveToLibrary, 'Save to my list',
                                <ArchiveOutlinedIcon fontSize={'small'}/>, archive, 'Archive'
                              )
                            )
                          }
                        </div>
                      </div>
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
                            <Typography variant="body1" component="div" className={`line-clamp-3`}>
                              {page.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" className={`line-clamp-3`}>
                              {page.description}
                            </Typography>
                          </CardContent>
                        </div>
                      </Card>
                      <div className={'mt-2 flex justify-center gap-2'}>
                        <Button variant={"text"} color={"info"} size={"small"} startIcon={<ArticleIcon/>}
                                onClick={articlePreview}>Article Preview</Button>
                        
                        {shortcuts && shortcuts.length > 0 && (
                          <>
                            <Button 
                              variant={"text"} 
                              color={"primary"} 
                              size={"small"} 
                              startIcon={<SmartToyOutlinedIcon />}
                              endIcon={processingShortcut ? <CircularProgress size={14} /> : null}
                              onClick={handleShortcutMenuOpen}
                              disabled={processingShortcut}
                            >
                              AI Shortcuts
                            </Button>
                            <Menu
                              anchorEl={shortcutMenuAnchorEl}
                              open={shortcutMenuOpen}
                              onClose={handleShortcutMenuClose}
                            >
                              {shortcuts.map(shortcut => (
                                <MenuItem 
                                  key={shortcut.id} 
                                  onClick={() => handleShortcutClick(shortcut.id, shortcut.name)}
                                  disabled={processingShortcut}
                                >
                                  {shortcut.name}
                                </MenuItem>
                              ))}
                            </Menu>
                          </>
                        )}
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
  }
;

const root = createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <StyledEngineProvider injectFirst>
    <CssBaseline/>
    <Popup/>
  </StyledEngineProvider>
);