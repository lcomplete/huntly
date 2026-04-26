import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
import {
  readSyncStorageSettings,
  StorageSettings,
  ContentParserType,
  getThinkingModeEnabled,
  saveThinkingModeEnabled,
} from "./storage";
import { ExtensionI18nProvider, useI18n } from "./i18n";
import { combineUrl } from "./utils";
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
import MenuBookTwoToneIcon from '@mui/icons-material/MenuBookTwoTone';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { log } from "./logger";
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
import { LibrarySaveStatus } from "./model/librarySaveStatus";
import { PageOperateResult } from "./model/pageOperateResult";
import { detectRssFeed } from "./rss/rssDetection";
import type { ShortcutItem, ModelItem } from "./components/AIToolbar";

// Parser selector component - only shows the alternative parser option
const ParserSelector = ({ parserType, onParserChange }: {
  parserType: ContentParserType;
  onParserChange: (parser: ContentParserType) => void;
}) => {
  const { t } = useI18n();
  const alternativeParser = parserType === 'readability' ? 'defuddle' : 'readability';
  const alternativeLabel =
    alternativeParser === 'readability'
      ? t("general.contentParser.readability.title")
      : t("general.contentParser.defuddle.title");

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
        {t("popup.parser.tryAnother")}
      </Typography>
      <Button
        size="small"
        variant="outlined"
        onClick={() => onParserChange(alternativeParser)}
        sx={{ minWidth: 'auto', px: 1, py: 0.25, fontSize: '0.75rem' }}
      >
        {alternativeLabel}
      </Button>
    </Box>
  );
};

const LazyAIToolbar = lazy(() =>
  import("./components/AIToolbar").then((module) => ({
    default: module.AIToolbar,
  }))
);

const LazyRssSubscription = lazy(() =>
  import("./rss/RssSubscription").then((module) => ({
    default: module.RssSubscription,
  }))
);

const LazySaveDetailPanel = lazy(() => import("./components/SaveDetailPanel"));

interface ParseDocResponse {
  page?: PageModel;
  parserType?: ContentParserType;
  isHuntlySite?: boolean;
}

interface ActiveTabMessageResult {
  ok: boolean;
  tab: chrome.tabs.Tab | null;
  response?: any;
}

const Popup = () => {
  const { t } = useI18n();
  const [storageSettings, setStorageSettings] = useState<StorageSettings>(null);
  const [username, setUsername] = useState<string>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [serverConnectionFailed, setServerConnectionFailed] = useState(false);
  const [page, setPage] = useState<PageModel>(null);
  const [autoSavedPageId, setAutoSavedPageId] = useState<number>(0);
  const [articleOperateResult, setArticleOperateResult] = useState<PageOperateResult>(null);

  // Parser state
  const [parserType, setParserType] = useState<ContentParserType>("readability");
  const [parsingArticle, setParsingArticle] = useState(false);
  const [parseFailed, setParseFailed] = useState(false);
  const [isHuntlySite, setIsHuntlySite] = useState(false);

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
  const [thinkingModeEnabled, setThinkingModeEnabled] = useState(false);

  // Save detail panel state
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  // RSS Feed Detection
  const [isRssFeed, setIsRssFeed] = useState(false);
  const [rssFeedUrl, setRssFeedUrl] = useState<string>('');
  const activeTabRef = useRef<chrome.tabs.Tab | null>(null);
  const activeTabPromiseRef = useRef<Promise<chrome.tabs.Tab | null> | null>(null);

  const getActiveTab = useCallback(async (): Promise<chrome.tabs.Tab | null> => {
    if (activeTabRef.current) {
      return activeTabRef.current;
    }

    if (!activeTabPromiseRef.current) {
      activeTabPromiseRef.current = chrome.tabs
        .query({ active: true, currentWindow: true })
        .then((tabs) => {
          activeTabRef.current = tabs[0] || null;
          return activeTabRef.current;
        })
        .finally(() => {
          activeTabPromiseRef.current = null;
        });
    }

    return activeTabPromiseRef.current;
  }, []);

  const sendMessageToTab = useCallback(
    (tabId: number, message: Message): Promise<{ ok: boolean; response?: any }> => {
      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            log("[Huntly] sendMessageToTab error:", chrome.runtime.lastError.message, "type:", message.type);
            resolve({ ok: false });
            return;
          }
          resolve({ ok: true, response });
        });
      });
    },
    []
  );

  const sendMessageToActiveTab = useCallback(
    async (message: Message): Promise<ActiveTabMessageResult> => {
      const tab = await getActiveTab();
      if (!tab?.id) {
        return { ok: false, tab };
      }

      const result = await sendMessageToTab(tab.id, message);
      return {
        ok: result.ok,
        tab,
        response: result.response,
      };
    },
    [getActiveTab, sendMessageToTab]
  );

  const postMessageToActiveTab = useCallback(async (message: Message): Promise<boolean> => {
    const tab = await getActiveTab();
    if (!tab?.id) {
      return false;
    }

    chrome.tabs.sendMessage(tab.id, message);
    return true;
  }, [getActiveTab]);

  useEffect(() => {
    const handleRuntimeMessage = (msg: Message) => {
      log(msg);
      if (msg.type === "save_clipper_success") {
        setAutoSavedPageId(msg.payload["id"]);
      }
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, []);

  const loadArticlePage = useCallback(async (customParserType?: ContentParserType, keepPageOnFail?: boolean) => {
    setParsingArticle(true);
    setParseFailed(false);
    const { ok, response } = await sendMessageToActiveTab({
      type: 'parse_doc',
      payload: customParserType ? { parserType: customParserType } : undefined
    });

    setParsingArticle(false);

    if (!ok) {
      log("[Huntly] parse_doc: content script not reachable (ok=false)");
    }

    const parseResponse = ok ? response as ParseDocResponse : null;
    if (parseResponse) {
      setIsHuntlySite(parseResponse.isHuntlySite === true);
      if (parseResponse.page) {
        setPage(parseResponse.page);
        if (parseResponse.parserType) {
          setParserType(parseResponse.parserType);
        }
        return parseResponse;
      }
      log("[Huntly] parse_doc: content script responded but page is empty");
    }

    if (!keepPageOnFail) {
      setPage(null);
    }
    setParseFailed(true);
    return null;
  }, [sendMessageToActiveTab]);

  const setSettingsState = useCallback((settings: StorageSettings) => {
    setStorageSettings(settings);
    const preferredParser = settings.contentParser || "readability";
    setParserType(preferredParser);
    void loadArticlePage(preferredParser, false);

    if (!settings.serverUrl) {
      setUsername(null);
      setArticleOperateResult(null);
      setLoadingUser(false);
      setServerConnectionFailed(false);
      return;
    }

    setLoadingUser(true);
    setServerConnectionFailed(false);
    getLoginUserInfo().then((data) => {
      const result = JSON.parse(data);
      setUsername(result.username);
    }).catch(() => {
      setUsername(null);
      setArticleOperateResult(null);
      setServerConnectionFailed(true);
    }).finally(() => {
      setLoadingUser(false);
    });
  }, [loadArticlePage]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([readSyncStorageSettings(), getThinkingModeEnabled()]).then(
      ([settings, savedThinkingModeEnabled]) => {
        if (!cancelled) {
          setThinkingModeEnabled(savedThinkingModeEnabled);
          setSettingsState(settings);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [setSettingsState]);

  const handleThinkingModeToggle = useCallback(() => {
    setThinkingModeEnabled((prev) => {
      const next = !prev;
      void saveThinkingModeEnabled(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkForRssFeed() {
      try {
        const tab = await getActiveTab();
        if (tab?.id && tab.url) {
          const feedInfo = await detectRssFeed(tab.url, tab.id);
          if (!cancelled && feedInfo.isRssFeed) {
            setIsRssFeed(true);
            setRssFeedUrl(tab.url);
          }
        }
      } catch (error) {
        log('RSS detection error:', error);
      }
    }

    void checkForRssFeed();
    return () => {
      cancelled = true;
    };
  }, [getActiveTab]);

  useEffect(() => {
    if (!page && !snippetPage) {
      return;
    }

    void import("./components/AIToolbar");
  }, [page, snippetPage]);

  useEffect(() => {
    if (!storageSettings?.serverUrl || !username || serverConnectionFailed || !page?.url) {
      return;
    }

    loadPageOperateResult(autoSavedPageId, page.url, setArticleOperateResult);
  }, [autoSavedPageId, page?.url, serverConnectionFailed, storageSettings?.serverUrl, username]);

  function handleTabChange(event: React.SyntheticEvent, newValue: number) {
    setActiveTab(newValue);
    if (newValue === 1) {
      if (!snippetPage) {
        void checkSnippetSelection();
      }
    }
  }

  async function checkSnippetSelection() {
    setCheckingSnippet(true);
    setSnippetOperateResult(null);
    setIsRestoredSnippet(false);
    const { ok, response } = await sendMessageToActiveTab({ type: 'get_selection' });
    setCheckingSnippet(false);

    if (ok && response?.page) {
      const sPage = response.page;
      sPage.contentType = 4; // SNIPPET
      setSnippetPage(sPage);
      setIsRestoredSnippet(response.isRestored === true);
      return;
    }

    setSnippetPage(null);
    setIsRestoredSnippet(false);
  }

  function loadPageOperateResult(pageId, url, setResult) {
    getPageOperateResult(pageId, url).then((result) => {
      if (result) {
        const operateResult = JSON.parse(result);
        setResult(operateResult);
        return;
      }
      setResult(null);
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
    chrome.tabs.create({ url: combineUrl(storageSettings.serverUrl, "/signin") });
  }

  function openHuntly() {
    chrome.tabs.create({ url: storageSettings.serverUrl });
  }

  function notifyBadgeRefresh() {
    void getActiveTab().then((tab) => {
      if (tab?.id) {
        chrome.runtime.sendMessage({
          type: 'badge_refresh',
          payload: { tabId: tab.id, url: tab.url }
        });
      }
    });
  }

  async function sendToHuntly() {
    const pageId = await savePage(activePage);
    if (pageId > 0) {
      loadPageOperateResult(pageId, activePage.url, setActiveOperateResult);
      notifyBadgeRefresh();
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
    notifyBadgeRefresh();
  }

  async function readLater() {
    const pageId = await ensureSavePage(activePage);
    const operateResult = await readLaterPage(pageId);
    setActiveOperateResult(operateResult);
    notifyBadgeRefresh();
  }

  async function unStar() {
    const pageId = await ensureSavePage(activePage);
    const operateResult = await unStarPage(pageId);
    setActiveOperateResult(operateResult);
    notifyBadgeRefresh();
  }

  async function star() {
    const pageId = await ensureSavePage(activePage);
    const operateResult = await starPage(pageId);
    setActiveOperateResult(operateResult);
    notifyBadgeRefresh();
  }

  async function saveToLibrary() {
    const pageId = await ensureSavePage(activePage);
    const operateResult = await savePageToLibrary(pageId);
    setActiveOperateResult(operateResult);
    notifyBadgeRefresh();
  }

  async function removeFromLibrary() {
    const pageId = await ensureSavePage(activePage);
    const operateResult = await removePageFromLibrary(pageId);
    setActiveOperateResult(operateResult);
    notifyBadgeRefresh();
  }

  async function archive() {
    const pageId = await ensureSavePage(activePage);
    const operateResult = await archivePage(pageId);
    setActiveOperateResult(operateResult);
    notifyBadgeRefresh();
  }

  async function openSaveDetailPanel() {
    const pageId = await ensureSavePage(activePage);
    if (pageId > 0) {
      // Ensure it's saved to library (mylist)
      if (!activeOperateResult?.id || activeOperateResult.librarySaveStatus === LibrarySaveStatus.NotSaved) {
        const operateResult = await savePageToLibrary(pageId);
        setActiveOperateResult(operateResult);
        notifyBadgeRefresh();
      }
      setShowDetailPanel(true);
    }
  }

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  async function deletePageData() {
    if (activeOperateResult?.id > 0) {
      await deletePage(activeOperateResult.id);
      setActiveOperateResult(null);
      handleCloseDeleteDialog();
      notifyBadgeRefresh();
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
          activeOperateResult?.id ? <Tooltip title={t("popup.actions.deleteForever")} placement={"right"}>
            <IconButton onClick={showDeleteDialog} className={"mt-2 bg-white shadow-heavy hover:bg-white"}
              color={"error"}>
              <DeleteForeverIcon fontSize={"small"} />
            </IconButton>
          </Tooltip> : <Tooltip title={t("popup.actions.sendToHuntly")} placement={"right"}>
            <IconButton onClick={sendToHuntly} className={"mt-2 bg-white shadow-heavy hover:bg-white"}
            >
              <SendIcon fontSize={"small"} />
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
            {t("popup.deleteDialog.title")}
          </DialogTitle>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog}>{t("common.cancel")}</Button>
            <Button onClick={deletePageData} autoFocus color={'warning'}>
              {t("common.delete")}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </div>;
  }

  async function articlePreview() {
    const opened = await postMessageToActiveTab({
      type: 'shortcuts_preview',
      payload: {
        page: activePage,
        parserType: parserType,
        initialThinkingModeEnabled: thinkingModeEnabled,
      }
    });

    if (!opened) {
      return;
    }

    // Close popup window
    window.close();
  }

  // Handle AI shortcut click from AIToolbar
  const handleAIShortcutClick = async (shortcut: ShortcutItem, selectedModel: ModelItem | null) => {
    if (!activePage || processingShortcut) return;

    setProcessingShortcut(true);

    // Open preview with auto-execute shortcut
    const opened = await postMessageToActiveTab({
      type: 'shortcuts_preview',
      payload: {
        page: activePage,
        parserType: parserType,
        autoExecuteShortcut: shortcut,
        autoSelectedModel: selectedModel,
        initialThinkingModeEnabled: thinkingModeEnabled,
      }
    });

    if (!opened) {
      setProcessingShortcut(false);
      return;
    }

    // Close popup window
    window.close();
  };

  const settingsLoaded = storageSettings !== null;
  const showSignInPrompt =
    settingsLoaded &&
    !loadingUser &&
    !!storageSettings?.serverUrl &&
    !username &&
    !serverConnectionFailed;
  const canShowMainContent = settingsLoaded && !showSignInPrompt;
  const hideHuntlyAI =
    serverConnectionFailed ||
    Boolean(storageSettings?.serverUrl && !username);

  return (
    <div style={{ minWidth: "600px", minHeight: '200px', display: 'flex', flexDirection: 'column', maxHeight: '600px', overflow: 'hidden' }} className={'mb-4'}>
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
            !loadingUser && username && <Tooltip title={t("popup.signedIn")} placement={'bottom'}>
              <IconButton onClick={openHuntly}>
                <PersonPinIcon className={'text-sky-600'} />
              </IconButton>
            </Tooltip>
          }
          <Tooltip title={t("common.setup")} placement={'bottom'}>
            <IconButton onClick={openOptionsPage}>
              <SettingsOutlinedIcon className={'text-sky-600'} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <div className={'commonPadding'} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {
              !settingsLoaded && <div className={'flex justify-center items-center h-[120px]'}>
                <CircularProgress />
              </div>
            }
            {/* Server configured but not signed in and server is reachable */}
            {
              showSignInPrompt && <div>
                <div className={'mt-5'}>
                  <Alert severity={'info'}>{t("popup.signIn.prompt")}</Alert>
                </div>
                <div className={'mt-5 mb-10'}>
                  <Button fullWidth={true} color={"primary"} variant={'contained'} onClick={openSignIn}>{t("popup.signIn.button")}</Button>
                </div>
              </div>
            }
            {/* Server configured and signed in, no server configured (read-only mode), or server connection failed */}
            {
              canShowMainContent && <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {/* Server connection failed warning */}
                {serverConnectionFailed && (
                  <div className={'mb-2'}>
                    <Alert severity={'warning'}>
                      {t("popup.server.unreachable")}
                    </Alert>
                  </div>
                )}
                {loadingUser && storageSettings?.serverUrl && !serverConnectionFailed && (
                  <div className={'mb-2'}>
                    <Alert severity={'info'}>{t("popup.server.checkingAccount")}</Alert>
                  </div>
                )}
                {/* RSS Feed Subscription Interface */}
                {isRssFeed && (
                  <Suspense fallback={
                    <div className={'flex justify-center items-center h-[120px]'}>
                      <CircularProgress />
                    </div>
                  }>
                    <LazyRssSubscription feedUrl={rssFeedUrl} />
                  </Suspense>
                )}
                {/* Regular Popup Interface - shown when not an RSS feed */}
                {!isRssFeed && (
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, flexShrink: 0 }}>
                      <Tabs value={activeTab} onChange={handleTabChange} aria-label={t("popup.tabs.aria")} variant="fullWidth" sx={{
                        minHeight: '36px',
                        '& .MuiTab-root': {
                          minHeight: '36px',
                          textTransform: 'none',
                          fontWeight: 'bold',
                          fontSize: '0.9rem'
                        }
                      }}>
                        <Tab label={t("popup.tabs.article")} />
                        <Tab label={t("popup.tabs.snippet")} />
                      </Tabs>
                    </Box>

                    {/* Article Tab Content */}
                    <div role="tabpanel" hidden={activeTab !== 0} style={{ flexShrink: 0 }}>
                      {
                        parsingArticle && <div className={'flex justify-center items-center h-[120px]'}>
                          <CircularProgress />
                        </div>
                      }
                      {
                        !parsingArticle && !page && <div>
                          <Alert severity={'warning'} sx={{ mb: 2 }}>
                            {t("popup.article.notArticle")}
                          </Alert>
                          <ParserSelector
                            parserType={parserType}
                            onParserChange={(newParser) => {
                              setParserType(newParser);
                              void loadArticlePage(newParser, false);
                            }}
                          />
                        </div>
                      }
                    </div>

                    {/* Snippet Tab Content - Check State */}
                    <div role="tabpanel" hidden={activeTab !== 1} style={{ flexShrink: 0 }}>
                      {
                        checkingSnippet && <div className={'flex justify-center items-center h-[120px]'}><CircularProgress /></div>
                      }
                      {
                        !checkingSnippet && !snippetPage && <div className={'mt-4'}>
                          <Alert severity="info" action={
                            <Button color="inherit" size="small" onClick={checkSnippetSelection}>{t("common.retry")}</Button>
                          }>
                            {t("popup.snippet.selectContent")}
                          </Alert>
                        </div>
                      }
                    </div>

                    {/* Shared Content View (Article or Snippet) */}
                    {
                      ((activeTab === 0 && page) || (activeTab === 1 && snippetPage)) && <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        {
                          activeTab === 1 && isRestoredSnippet && <div className={'mb-2'}>
                            <Alert severity={'info'}>
                              {t("popup.snippet.restored")}
                            </Alert>
                          </div>
                        }
                        {
                          storageSettings?.serverUrl && username && !loadingUser && !isHuntlySite && activeOperateResult && activeOperateResult.id > 0 && <div className={'mb-2'}>
                            <Alert severity={'success'}>
                              {activeTab === 0 ? t("popup.saved.article") : t("popup.saved.snippet")}
                              <a href={combineUrl(storageSettings.serverUrl, "/page/" + activeOperateResult.id)} target={'_blank'}
                                className={'ml-1'}>{t("common.view")}</a>
                            </Alert>
                          </div>
                        }
                        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                          {showDetailPanel && activeOperateResult?.id > 0 ? (
                            <Suspense fallback={
                              <div className={'flex justify-center items-center h-[160px]'}>
                                <CircularProgress />
                              </div>
                            }>
                              <LazySaveDetailPanel
                                pageId={activeOperateResult.id}
                                page={activePage}
                                operateResult={activeOperateResult}
                                initialParserType={parserType}
                                faviconUrl={activePage.faviconUrl}
                                onClose={() => setShowDetailPanel(false)}
                                onDeleted={() => {
                                  setActiveOperateResult(null);
                                  setShowDetailPanel(false);
                                }}
                                onOperateResultChanged={(result) => setActiveOperateResult(result)}
                              />
                            </Suspense>
                          ) : (
                            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: '16px' }}>
                              <div className={'flex items-center'}>
                                <TextField value={activePage.url} size={"small"} fullWidth={true} disabled={true} />
                                {/* Only show action buttons when server is configured, connected, and not on Huntly site */}
                                {storageSettings?.serverUrl && username && !loadingUser && !isHuntlySite && !serverConnectionFailed && <div className={'grow shrink-0 pl-2 flex items-center'}>
                                  {
                                    activeOperateResult?.readLater ? (
                                      <Tooltip title={t("popup.actions.removeFromReadLater")}>
                                        <IconButton onClick={unReadLater}>
                                          <BookmarkAddedIcon fontSize={"small"} />
                                        </IconButton>
                                      </Tooltip>
                                    ) : (
                                      <Tooltip title={t("popup.actions.readLater")}>
                                        <IconButton onClick={readLater}>
                                          <BookmarkBorderIcon fontSize={"small"} />
                                        </IconButton>
                                      </Tooltip>
                                    )
                                  }
                                  {
                                    activeOperateResult?.starred ? (
                                      <Tooltip title={t("popup.actions.removeFromStarred")}>
                                        <IconButton onClick={unStar}>
                                          <StarIcon fontSize={"small"} />
                                        </IconButton>
                                      </Tooltip>
                                    ) : (
                                      <Tooltip title={t("popup.actions.starPage")}>
                                        <IconButton onClick={star}>
                                          <StarBorderIcon fontSize={"small"} />
                                        </IconButton>
                                      </Tooltip>
                                    )
                                  }
                                  {
                                    activeOperateResult?.librarySaveStatus === LibrarySaveStatus.Archived ? (
                                      groupSaveAction(
                                        <ArchiveIcon fontSize={'small'} />, saveToLibrary, t("popup.actions.removeFromArchive"),
                                        <PlaylistAddCheckOutlinedIcon fontSize={'small'} />, removeFromLibrary, t("popup.actions.removeFromMyList"))
                                    ) : activeOperateResult?.librarySaveStatus === LibrarySaveStatus.Saved ? (
                                      groupSaveAction(
                                        <PlaylistAddCheckOutlinedIcon fontSize={'small'} />, removeFromLibrary, t("popup.actions.removeFromMyList"),
                                        <ArchiveOutlinedIcon fontSize={'small'} />, archive, t("popup.actions.archive")
                                      )
                                    ) : (
                                      groupSaveAction(
                                        <PlaylistAddOutlinedIcon fontSize={"small"} />, saveToLibrary, t("popup.actions.saveToMyList"),
                                        <ArchiveOutlinedIcon fontSize={'small'} />, archive, t("popup.actions.archive")
                                      )
                                    )
                                  }
                                  <Tooltip title={t("popup.actions.editDetails")}>
                                    <IconButton onClick={openSaveDetailPanel}>
                                      <EditOutlinedIcon fontSize={"small"} />
                                    </IconButton>
                                  </Tooltip>
                                </div>}
                              </div>
                              <Card className={`mainBorder mt-2 w-full flex`}>
                                {
                                  activeTab === 0 && activePage.thumbUrl &&
                                  <div className={'w-[130px] flex items-center shrink-0'}
                                    style={{ backgroundColor: 'rgb(247,249,249)' }}>
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
                                    style={{ backgroundColor: 'rgb(247,249,249)' }}>
                                    <CardMedia
                                      component={ArticleIcon}
                                      className={'grow'}
                                    />
                                  </div>
                                }

                                {/* Article Card Content */}
                                {activeTab === 0 && <div className={'flex flex-col flex-1'}>
                                  <CardContent sx={{ borderLeft: '1px solid #ccc', flex: 1 }}>
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
                                    <Button variant={"text"} color={"info"} size={"small"} startIcon={<MenuBookTwoToneIcon />}
                                      onClick={articlePreview}>{t("popup.readingMode")}</Button>
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
                                    <Button variant={"text"} color={"info"} size={"small"} startIcon={<MenuBookTwoToneIcon />}
                                      onClick={articlePreview}>Reading Mode</Button>
                                  </Box>
                                </div>}
                              </Card>
                            </div>
                          )}

                          {!showDetailPanel && (
                            <div className={'mt-2 flex justify-center'}>
                              <Suspense fallback={
                                <div className={'flex justify-center items-center h-10'}>
                                  <CircularProgress size={20} />
                                </div>
                              }>
                                <LazyAIToolbar
                                  onShortcutClick={handleAIShortcutClick}
                                  isProcessing={processingShortcut}
                                  compact={true}
                                  hideHuntlyAI={hideHuntlyAI}
                                  showThinkingToggle={true}
                                  thinkingModeEnabled={thinkingModeEnabled}
                                  onThinkingModeToggle={handleThinkingModeToggle}
                                />
                              </Suspense>
                            </div>
                          )}
                        </div>
                      </div>
                    }
                  </div>
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
    <ExtensionI18nProvider>
      <CssBaseline />
      <Popup />
    </ExtensionI18nProvider>
  </StyledEngineProvider>
);
