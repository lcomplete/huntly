import React, {useEffect, useState} from "react";
import { createRoot } from 'react-dom/client';
import './popup.css';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress, CssBaseline, Dialog, DialogActions, DialogTitle,
  IconButton, StyledEngineProvider,
  Tabs, Tab,
  TextField,
  Tooltip, Typography
} from "@mui/material";
import {readSyncStorageSettings, StorageSettings, ContentParserType} from "./storage";
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
import VisibilityIcon from '@mui/icons-material/Visibility';
import {log} from "./logger";
import {
  archivePage,
  deletePage,
  getLoginUserInfo,
  getPageOperateResult,
  readLaterPage, removePageFromLibrary,
  saveArticle, savePageToLibrary, starPage,
  unReadLaterPage,
  unStarPage,
} from "./services";
import {LibrarySaveStatus} from "./model/librarySaveStatus";
import {PageOperateResult} from "./model/pageOperateResult";
import {detectRssFeed, RssSubscription} from "./rss";
import AIToolbar, { ShortcutItem, ModelItem, AIGradientDef } from "./components/AIToolbar";

const Popup = () => {
    const [storageSettings, setStorageSettings] = useState<StorageSettings>(null);
    const [username, setUsername] = useState<string>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [page, setPage] = useState<PageModel>(null);
    const [autoSavedPageId, setAutoSavedPageId] = useState<number>(0);
    const [articleOperateResult, setArticleOperateResult] = useState<PageOperateResult>(null);

    // Parser state
    const [parserType, setParserType] = useState<ContentParserType>("readability");
    const [parsingArticle, setParsingArticle] = useState(false);
    const [parseFailed, setParseFailed] = useState(false);

    // Tabs
    const [activeTab, setActiveTab] = useState(0);
    const [snippetPage, setSnippetPage] = useState<PageModel>(null);
    const [checkingSnippet, setCheckingSnippet] = useState(false);
    const [snippetOperateResult, setSnippetOperateResult] = useState<PageOperateResult>(null);
    const [isRestoredSnippet, setIsRestoredSnippet] = useState(false); // Track if snippet is from last session

    // Computed
    const activePage = activeTab === 0 ? page : snippetPage;
    const activeOperateResult = activeTab === 0 ? articleOperateResult : snippetOperateResult;
    const setActiveOperateResult = activeTab === 0 ? setArticleOperateResult : setSnippetOperateResult;

    // AI processing state
    const [processingShortcut, setProcessingShortcut] = useState(false);

    // RSS Feed Detection
    const [isRssFeed, setIsRssFeed] = useState(false);
    const [rssFeedUrl, setRssFeedUrl] = useState<string>('');
    const [checkingRssFeed, setCheckingRssFeed] = useState(true);

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

    // RSS Feed Detection Effect
    useEffect(() => {
      async function checkForRssFeed() {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const tab = tabs[0];
          if (tab && tab.url) {
            const feedInfo = await detectRssFeed(tab.url);
            if (feedInfo.isRssFeed) {
              setIsRssFeed(true);
              setRssFeedUrl(tab.url);
            }
          }
        } catch (error) {
          log('RSS detection error:', error);
        } finally {
          setCheckingRssFeed(false);
        }
      }
      checkForRssFeed();
    }, []);

    function setSettingsState(settings: StorageSettings) {
      setStorageSettings(settings);
      if (!settings.serverUrl) {
        // No server enabled - still load page info for parsing, but skip server-related operations
        setLoadingUser(false);
        loadPageInfoOnly();
      } else {
        setLoadingUser(true);
        getLoginUserInfo().then((data) => {
          const result = JSON.parse(data);
          setUsername(result.username);

          loadPageInfo();
        }).catch(() => {
          setUsername(null);
        }).finally(() => {
          setLoadingUser(false);
        });
      }
    }

    function loadPageInfoOnly(customParserType?: ContentParserType) {
      setParsingArticle(true);
      setParseFailed(false);
      chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        const tab = tabs[0];
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'parse_doc',
            payload: { parserType: customParserType }
          }, function (response) {
            setParsingArticle(false);
            if(response) {
              setPage(response.page);
              if (response.parserType) {
                setParserType(response.parserType);
              }
              if (!response.page) {
                setParseFailed(true);
              }
            } else {
              setParseFailed(true);
            }
          });
        } else {
          setParsingArticle(false);
          setParseFailed(true);
        }
      });
    }

    function loadPageInfo(customParserType?: ContentParserType) {
      setParsingArticle(true);
      setParseFailed(false);
      chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        const tab = tabs[0];
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'parse_doc',
            payload: { parserType: customParserType }
          }, function (response) {
            setParsingArticle(false);
            if(response) {
              setPage(response.page);
              if (response.parserType) {
                setParserType(response.parserType);
              }
              if (response.page) {
                loadPageOperateResult(autoSavedPageId, response.page.url, setArticleOperateResult);
              } else {
                setParseFailed(true);
              }
            } else {
              setParseFailed(true);
            }
          });
        } else {
          setParsingArticle(false);
          setParseFailed(true);
        }
      });
    }

    function handleTabChange(event: React.SyntheticEvent, newValue: number) {
      setActiveTab(newValue);
      if (newValue === 1) {
        if (!snippetPage) {
            checkSnippetSelection();
        }
      }
    }

    function checkSnippetSelection() {
      setCheckingSnippet(true);
      setSnippetOperateResult(null);
      setIsRestoredSnippet(false);
      chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        const tab = tabs[0];
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {type: 'get_selection'}, function (response) {
            setCheckingSnippet(false);
            if (response && response.page) {
              const sPage = response.page;
              sPage.contentType = 4; // SNIPPET
              setSnippetPage(sPage);
              // Check if this is a restored snippet from page memory
              setIsRestoredSnippet(response.isRestored === true);
            } else {
              setSnippetPage(null);
              setIsRestoredSnippet(false);
            }
          });
        } else {
            setCheckingSnippet(false);
        }
      });
    }

    function loadPageOperateResult(pageId, url, setResult) {
      getPageOperateResult(pageId, url).then((result) => {
        if (result) {
          const operateResult = JSON.parse(result);
          setResult(operateResult);
        }
      });
    }

    function openOptionsPage() {
      chrome.runtime.openOptionsPage();
    }

    function getDomain(serverUrl: string) {
      const url = new URL(serverUrl);
      return url.hostname;
    }

    function openSignIn() {
      chrome.tabs.create({url: combineUrl(storageSettings.serverUrl, "/signin")});
    }

    function openHuntly() {
      chrome.tabs.create({url: storageSettings.serverUrl});
    }

    async function sendToHuntly() {
      const pageId = await savePage(activePage);
      if (pageId > 0) {
        loadPageOperateResult(pageId, activePage.url, setActiveOperateResult);
      }
    }

    async function savePage(pageToSave): Promise<number> {
      const resp = await saveArticle(pageToSave);
      if (resp) {
        const json = JSON.parse(resp);
        if (json.data) {
          return json.data;
        }
      }
      return 0;
    }

    async function ensureSavePage(pageToSave): Promise<number> {
      if (activeOperateResult?.id > 0) {
        return activeOperateResult.id;
      }
      return savePage(pageToSave);
    }

    async function unReadLater() {
      const pageId = await ensureSavePage(activePage);
      const operateResult = await unReadLaterPage(pageId);
      setActiveOperateResult(operateResult);
    }

    async function readLater() {
      const pageId = await ensureSavePage(activePage);
      const operateResult = await readLaterPage(pageId);
      setActiveOperateResult(operateResult);
    }

    async function unStar() {
      const pageId = await ensureSavePage(activePage);
      const operateResult = await unStarPage(pageId);
      setActiveOperateResult(operateResult);
    }

    async function star() {
      const pageId = await ensureSavePage(activePage);
      const operateResult = await starPage(pageId);
      setActiveOperateResult(operateResult);
    }

    async function saveToLibrary() {
      const pageId = await ensureSavePage(activePage);
      const operateResult = await savePageToLibrary(pageId);
      setActiveOperateResult(operateResult);
    }

    async function removeFromLibrary() {
      const pageId = await ensureSavePage(activePage);
      const operateResult = await removePageFromLibrary(pageId);
      setActiveOperateResult(operateResult);
    }

    async function archive() {
      const pageId = await ensureSavePage(activePage);
      const operateResult = await archivePage(pageId);
      setActiveOperateResult(operateResult);
    }

    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

    async function deletePageData() {
      if (activeOperateResult?.id > 0) {
        await deletePage(activeOperateResult.id);
        setActiveOperateResult(null);
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
            activeOperateResult?.id ? <Tooltip title={"Delete forever"} placement={"right"}>
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

    async function articlePreview() {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      const tab = tabs[0];
      if (!tab) return;

      // Get AI toolbar data from background script for content script use
      const aiToolbarData = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ type: 'get_ai_toolbar_data' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to get AI toolbar data:', chrome.runtime.lastError);
            resolve({ success: false });
          } else {
            resolve(response || { success: false });
          }
        });
      });

      chrome.tabs.sendMessage(tab.id, {
        type: 'shortcuts_preview',
        payload: {
          page: activePage,
          externalShortcuts: aiToolbarData.success ? aiToolbarData.externalShortcuts : undefined,
          externalModels: aiToolbarData.success ? aiToolbarData.externalModels : undefined,
        }
      });

      // Close popup window
      window.close();
    }

    // Handle AI shortcut click from AIToolbar
    const handleAIShortcutClick = async (shortcut: ShortcutItem, selectedModel: ModelItem | null) => {
      if (!activePage || processingShortcut) return;

      setProcessingShortcut(true);

      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      const tab = tabs[0];
      if (!tab) return;

      // Get AI toolbar data from background script for content script use
      const aiToolbarData = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ type: 'get_ai_toolbar_data' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to get AI toolbar data:', chrome.runtime.lastError);
            resolve({ success: false });
          } else {
            resolve(response || { success: false });
          }
        });
      });

      // Open preview with auto-execute shortcut
      chrome.tabs.sendMessage(tab.id, {
        type: 'shortcuts_preview',
        payload: {
          page: activePage,
          externalShortcuts: aiToolbarData.success ? aiToolbarData.externalShortcuts : undefined,
          externalModels: aiToolbarData.success ? aiToolbarData.externalModels : undefined,
          autoExecuteShortcut: shortcut,
          autoSelectedModel: selectedModel,
        }
      });

      // Close popup window
      window.close();
    };

    return (
      <div style={{minWidth: "600px", minHeight: '200px'}} className={'mb-4'}>
        <AIGradientDef />
        <div className={'commonPadding header'}>
          <div className="flex items-center text-sky-600 font-bold">
            <img src="/favicon-16x16.png" alt="Huntly" className="h-4 w-4 mr-1" />
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
            <IconButton onClick={openOptionsPage}>
              <SettingsOutlinedIcon className={'text-sky-600'}/>
            </IconButton>
          </div>
        </div>

        <div className={'commonPadding'}>
          {
            <div>
              {
                loadingUser && <div className={'flex justify-center items-center h-[120px]'}>
                  <CircularProgress/>
                </div>
              }
              {/* Server configured but not signed in */}
              {
                !loadingUser && storageSettings?.serverUrl && !username && <div>
                  <div className={'mt-5'}>
                    <Alert severity={'info'}>Please sign in to start.</Alert>
                  </div>
                  <div className={'mt-5 mb-10'}>
                    <Button fullWidth={true} color={"primary"} variant={'contained'} onClick={openSignIn}>Sign In</Button>
                  </div>
                </div>
              }
              {/* Server configured and signed in, or no server configured (read-only mode) */}
              {
                !loadingUser && (username || !storageSettings?.serverUrl) && <div>
                  {/* RSS Feed Subscription Interface */}
                  {checkingRssFeed && (
                    <div className={'flex justify-center items-center h-[120px]'}>
                      <CircularProgress />
                    </div>
                  )}
                  {!checkingRssFeed && isRssFeed && (
                    <RssSubscription feedUrl={rssFeedUrl} />
                  )}
                  {/* Regular Popup Interface - shown when not an RSS feed */}
                  {!checkingRssFeed && !isRssFeed && (
                    <>
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tabs value={activeTab} onChange={handleTabChange} aria-label="huntly tabs" variant="fullWidth" sx={{
                        minHeight: '36px',
                        '& .MuiTab-root': {
                            minHeight: '36px',
                            textTransform: 'none',
                            fontWeight: 'bold',
                            fontSize: '0.9rem'
                        }
                    }}>
                      <Tab label="Article" />
                      <Tab label="Snippet" />
                    </Tabs>
                  </Box>

                  {/* Article Tab Content */}
                  <div role="tabpanel" hidden={activeTab !== 0}>
                    {
                      parsingArticle && <div className={'flex justify-center items-center h-[120px]'}>
                        <CircularProgress/>
                      </div>
                    }
                    {
                      !parsingArticle && !page && <div>
                        <Alert severity={'warning'} sx={{ mb: 2 }}>
                          This webpage doesn't look like an article page.
                        </Alert>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            Try another parser:
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant={parserType === 'readability' ? 'contained' : 'outlined'}
                              onClick={() => {
                                setParserType('readability');
                                username ? loadPageInfo('readability') : loadPageInfoOnly('readability');
                              }}
                            >
                              Readability
                            </Button>
                            <Button
                              size="small"
                              variant={parserType === 'defuddle' ? 'contained' : 'outlined'}
                              onClick={() => {
                                setParserType('defuddle');
                                username ? loadPageInfo('defuddle') : loadPageInfoOnly('defuddle');
                              }}
                            >
                              Defuddle
                            </Button>
                          </Box>
                        </Box>
                      </div>
                    }
                  </div>

                  {/* Snippet Tab Content - Check State */}
                  <div role="tabpanel" hidden={activeTab !== 1}>
                    {
                      checkingSnippet && <div className={'flex justify-center items-center h-[120px]'}><CircularProgress/></div>
                    }
                    {
                      !checkingSnippet && !snippetPage && <div className={'mt-4'}>
                        <Alert severity="info" action={
                          <Button color="inherit" size="small" onClick={checkSnippetSelection}>Retry</Button>
                        }>
                          Please select content on the page first.
                        </Alert>
                      </div>
                    }
                  </div>
                  
                  {/* Shared Content View (Article or Snippet) */}
                  {
                    ((activeTab === 0 && page) || (activeTab === 1 && snippetPage)) && <div>
                      {/* No server configured - show info message */}
                      {
                        !storageSettings?.serverUrl && <div className={'mb-2'}>
                          <Alert severity={'info'}>
                            No server configured. You can preview articles, but saving is disabled.
                            <span
                              className={'ml-1 text-sky-600 cursor-pointer hover:underline'}
                              onClick={openOptionsPage}
                            >
                              Configure server &gt;
                            </span>
                          </Alert>
                        </div>
                      }
                      {
                        activeTab === 1 && isRestoredSnippet && <div className={'mb-2'}>
                          <Alert severity={'info'}>
                            Showing your last snippet from this page.
                          </Alert>
                        </div>
                      }
                      {
                        storageSettings?.serverUrl && activeTab === 0 && autoSavedPageId > 0 && <div className={'mb-2'}>
                          <Alert severity={'success'}>This webpage has been automatically hunted.
                            <a href={combineUrl(storageSettings.serverUrl, "/page/" + autoSavedPageId)} target={'_blank'}
                               className={'ml-1'}>view</a>
                          </Alert>
                        </div>
                      }
                      {
                        storageSettings?.serverUrl && !autoSavedPageId && activeOperateResult && activeOperateResult.id > 0 && <div className={'mb-2'}>
                          <Alert severity={'info'}>
                            {activeTab === 0 ? 'This webpage has been hunted.' : 'This snippet has been saved.'}
                            <a href={combineUrl(storageSettings.serverUrl, "/page/" + activeOperateResult.id)} target={'_blank'}
                               className={'ml-1'}>view</a>
                          </Alert>
                        </div>
                      }
                      <div>
                        <div className={'flex items-center'}>
                          <TextField value={activePage.url} size={"small"} fullWidth={true} disabled={true}/>
                          {/* Only show action buttons when server is configured */}
                          {storageSettings?.serverUrl && <div className={'grow shrink-0 pl-2'}>
                            {
                              activeOperateResult?.readLater ? (
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
                              activeOperateResult?.starred ? (
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
                              activeOperateResult?.librarySaveStatus === LibrarySaveStatus.Archived ? (
                                groupSaveAction(
                                  <ArchiveIcon fontSize={'small'}/>, saveToLibrary, 'Remove from archive',
                                  <PlaylistAddCheckOutlinedIcon fontSize={'small'}/>, removeFromLibrary, 'Remove from my list')
                              ) : activeOperateResult?.librarySaveStatus === LibrarySaveStatus.Saved ? (
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
                          </div>}
                        </div>
                        <Card className={`mainBorder mt-2 w-full flex`}>
                          {
                            activeTab === 0 && activePage.thumbUrl &&
                            <div className={'w-[130px] flex items-center shrink-0'}
                                 style={{backgroundColor: 'rgb(247,249,249)'}}>
                              <CardMedia
                                component="img"
                                height={130}
                                image={activePage.thumbUrl}
                                alt={activePage.title}
                              />
                            </div>
                          }
                          {
                            activeTab === 0 && !activePage.thumbUrl &&
                            <div className={'w-[130px] flex items-center shrink-0'}
                                 style={{backgroundColor: 'rgb(247,249,249)'}}>
                              <CardMedia
                                component={ArticleIcon}
                                className={'grow'}
                              />
                            </div>
                          }

                          {/* Article Card Content */}
                          {activeTab === 0 && <div className={'flex flex-col flex-1'}>
                            <CardContent sx={{borderLeft: '1px solid #ccc', flex: 1}}>
                              <Typography variant="body2" color="text.secondary">
                                {activePage.domain}
                              </Typography>
                              <Typography variant="body1" component="div" className={`line-clamp-2`}>
                                {activePage.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" className={`line-clamp-2`}>
                                {activePage.description}
                              </Typography>
                            </CardContent>
                            <Box sx={{ px: 1.5, pb: 1, display: 'flex', justifyContent: 'flex-end', borderLeft: '1px solid #ccc' }}>
                              <Button variant={"text"} color={"info"} size={"small"} startIcon={<VisibilityIcon/>}
                                      onClick={articlePreview}>Reading Mode</Button>
                            </Box>
                          </div>}

                          {/* Snippet Card Content */}
                          {activeTab === 1 && <div className={'w-full flex flex-col'}>
                            <CardContent sx={{
                                maxHeight: '160px',
                                overflowY: 'auto',
                                padding: '10px !important',
                                '& p': { margin: '0 0 10px 0' },
                                flex: 1
                            }}>
                                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.75rem' }} gutterBottom>
                                    {activePage.title}
                                </Typography>
                                <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {activePage.description}
                                </Typography>
                            </CardContent>
                            <Box sx={{ px: 1.5, pb: 1, display: 'flex', justifyContent: 'flex-end' }}>
                              <Button variant={"text"} color={"info"} size={"small"} startIcon={<VisibilityIcon/>}
                                      onClick={articlePreview}>Reading Mode</Button>
                            </Box>
                          </div>}
                        </Card>

                        <div className={'mt-2 flex justify-center'}>
                          <AIToolbar
                            onShortcutClick={handleAIShortcutClick}
                            isProcessing={processingShortcut}
                            compact={true}
                          />
                        </div>
                      </div>
                    </div>
                  }
                    </>
                  )}
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