import React from "react";
import MainContainer from "../components/MainContainer";
import { Box, Button, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import {
  HighlightListItem,
  PageControllerApiFactory,
  PageHighlightControllerApiFactory,
  PageItem,
} from "../api";
import MagazineItem from "../components/MagazineItem";
import CompactItem from "../components/CompactItem";
import Loading from "../components/Loading";
import { Link, useNavigate } from "react-router-dom";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExtensionIcon from "@mui/icons-material/Extension";
import GitHubIcon from "@mui/icons-material/GitHub";
import InfoIcon from "@mui/icons-material/Info";
import SubHeader from "../components/SubHeader";
import navLabels from "../components/Sidebar/NavLabels";
import moment from "moment";
import { ConnectorType } from "../interfaces/connectorType";
import SmartMoment from "../components/SmartMoment";

const Home = () => {
  const navigate = useNavigate();
  const hotTweetsDateRange = React.useMemo(() => {
    const endDate = moment().toISOString();
    const startDate = moment().subtract(1, "day").toISOString();
    return { startDate, endDate };
  }, []);

  const {
    isLoading: isLoadingLatestFeed,
    error: latestFeedError,
    data: latestFeed,
  } = useQuery(["home-latest-feed"], async () => {
    const response = await PageControllerApiFactory().listPageItemsUsingGET(
      false, // asc
      undefined, // connectorId
      ConnectorType.RSS, // connectorType
      undefined, // contentFilterType
      undefined, // contentType
      8, // count
      undefined, // endDate
      undefined, // firstRecordAt
      undefined, // firstVoteScore
      undefined, // folderId
      undefined, // hasHighlights
      undefined, // lastRecordAt
      undefined, // lastVoteScore
      undefined, // markRead
      undefined, // readLater
      undefined, // saveStatus
      "CONNECTED_AT", // sort
      undefined, // sourceId
      undefined, // starred
      undefined // startDate
    );
    return response.data || [];
  });

  const {
    isLoading: isLoadingReadLater,
    error: readLaterError,
    data: readLaterPages,
  } = useQuery(["home-read-later"], async () => {
    const response = await PageControllerApiFactory().listPageItemsUsingGET(
      false, // asc
      undefined, // connectorId
      undefined, // connectorType
      undefined, // contentFilterType
      undefined, // contentType
      8, // count
      undefined, // endDate
      undefined, // firstRecordAt
      undefined, // firstVoteScore
      undefined, // folderId
      undefined, // hasHighlights
      undefined, // lastRecordAt
      undefined, // lastVoteScore
      undefined, // markRead
      true, // readLater
      undefined, // saveStatus
      "READ_LATER_AT", // sort
      undefined, // sourceId
      undefined, // starred
      undefined // startDate
    );
    return response.data || [];
  });

  const {
    isLoading: isLoadingRecentlyRead,
    error: recentlyReadError,
    data: recentlyReadPages,
  } = useQuery(["home-recently-read"], async () => {
    const response = await PageControllerApiFactory().listPageItemsUsingGET(
      false, // asc
      undefined, // connectorId
      undefined, // connectorType
      undefined, // contentFilterType
      undefined, // contentType
      8, // count
      undefined, // endDate
      undefined, // firstRecordAt
      undefined, // firstVoteScore
      undefined, // folderId
      undefined, // hasHighlights
      undefined, // lastRecordAt
      undefined, // lastVoteScore
      undefined, // markRead
      undefined, // readLater
      undefined, // saveStatus
      "LAST_READ_AT", // sort
      undefined, // sourceId
      undefined, // starred
      undefined // startDate
    );
    return response.data || [];
  });

  const {
    isLoading: isLoadingHighlights,
    error: highlightsError,
    data: highlights,
  } = useQuery(["home-highlights"], async () => {
    const response = await PageHighlightControllerApiFactory().getHighlightListUsingGET(
      "desc",
      undefined,
      0,
      8,
      "created_at"
    );
    return response.data?.data?.content || [];
  });

  const {
    isLoading: isLoadingHotTweets,
    error: hotTweetsError,
    data: hotTweets,
  } = useQuery(["home-hot-tweets", hotTweetsDateRange], async () => {
    const response = await PageControllerApiFactory().listPageItemsUsingGET(
      false, // asc
      undefined, // connectorId
      undefined, // connectorType
      2, // contentFilterType (2 = Tweet, includes both TWEET and QUOTED_TWEET)
      undefined, // contentType
      8, // count
      hotTweetsDateRange.endDate, // endDate
      undefined, // firstRecordAt
      undefined, // firstVoteScore
      undefined, // folderId
      undefined, // hasHighlights
      undefined, // lastRecordAt
      undefined, // lastVoteScore
      undefined, // markRead
      undefined, // readLater
      undefined, // saveStatus
      "VOTE_SCORE", // sort
      undefined, // sourceId
      undefined, // starred
      hotTweetsDateRange.startDate // startDate
    );
    return response.data || [];
  });

  const handleViewAll = (path: string) => () => {
    navigate(path);
  };

  const columnSx = {
    width: "100%",
    maxWidth: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 0,
  };

  const moduleSx = {
    p: { xs: 2, md: 2.5 },
    borderRadius: 2,
    backgroundColor: "background.paper",
    border: "1px solid",
    borderColor: "rgba(0,0,0,0.1)",
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
  };

  const renderPageList = (pages: PageItem[], emptyText: string, useTweetStyle: boolean = false) => {
    if (!pages || pages.length === 0) {
      return (
        <Box sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
          <Typography variant="body2">{emptyText}</Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: useTweetStyle ? 2.5 : 1 }}>
        {pages.map((page: PageItem) => {
          const isTweet = page.contentType === 1 || page.contentType === 3;
          // Use MagazineItem for tweets or when explicitly requested
          if (isTweet || useTweetStyle) {
            return <MagazineItem key={page.id} page={page} />;
          }
          // Use CompactItem for other content types
          return <CompactItem key={page.id} page={page} />;
        })}
      </Box>
    );
  };

  const renderHighlights = (items: HighlightListItem[]) => {
    if (!items || items.length === 0) {
      return (
        <Box sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
          <Typography variant="body2">No highlights yet.</Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((highlight) => {
          const highlightText = (highlight.highlightedText || "")
            .replace(/\s+/g, " ")
            .trim();
          const highlightKey =
            highlight.id ?? `${highlight.pageId}-${highlight.startOffset}-${highlight.endOffset}`;
          return (
            <Box
              key={highlightKey}
              sx={{
                p: 2,
                borderRadius: 1.5,
                backgroundColor: "rgba(0,0,0,0.02)",
                transition: "background-color 0.2s",
                "&:hover": {
                  backgroundColor: "rgba(0,0,0,0.04)",
                },
              }}
            >
              <Link
                to={`/page/${highlight.pageId}?h=${highlight.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    lineHeight: 1.6,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {highlightText || "Untitled highlight"}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "70%",
                    }}
                  >
                    {highlight.pageTitle || "Untitled page"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    - <SmartMoment dt={highlight.createdAt} />
                  </Typography>
                </Box>
              </Link>
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <MainContainer>
      <SubHeader
        navLabel={navLabels.home}
        buttonOptions={{ markRead: false, viewSwitch: false }}
        hideSearchOnMobile={false}
      />
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: '100vw', overflowX: 'hidden' }}>
        <Box sx={{ width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, 1fr)",
                lg: "repeat(3, 1fr)",
              },
              gap: { xs: 3, md: 4 },
              maxWidth: "100%",
            }}
          >
            <Box sx={columnSx}>
              <Box sx={moduleSx}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    pb: { xs: 1, md: 1.5 },
                    borderBottom: "1px solid",
                    borderColor: "rgba(0,0,0,0.06)",
                    mb: { xs: 2, md: 2.5 },
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: "1rem", md: "1.25rem" } }}>
                    Latest Feed
                  </Typography>
                  <Button
                    endIcon={<ArrowForwardIcon sx={{ fontSize: { xs: "1.25rem", md: "1.25rem" } }} />}
                    onClick={handleViewAll("/feeds")}
                    size="small"
                    sx={{
                      textTransform: "none",
                      fontSize: { xs: "0.75rem", md: "0.875rem" },
                      minWidth: { xs: "auto", md: "64px" },
                      px: { xs: 0.5, md: 1 },
                      "& .MuiButton-endIcon": {
                        ml: { xs: 0, md: 0.5 }
                      }
                    }}
                  >
                    <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>View All</Box>
                  </Button>
                </Box>
                {isLoadingLatestFeed && <Loading />}
                {latestFeedError && (
                  <Typography color="error">Failed to load latest feed</Typography>
                )}
                {!isLoadingLatestFeed &&
                  !latestFeedError &&
                  renderPageList(latestFeed || [], "No feed items yet.")}
              </Box>

              <Box sx={moduleSx}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    pb: { xs: 1, md: 1.5 },
                    borderBottom: "1px solid",
                    borderColor: "rgba(0,0,0,0.06)",
                    mb: { xs: 2, md: 2.5 },
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: "1rem", md: "1.25rem" } }}>
                    Recently Read
                  </Typography>
                  <Button
                    endIcon={<ArrowForwardIcon sx={{ fontSize: { xs: "1.25rem", md: "1.25rem" } }} />}
                    onClick={handleViewAll("/recently-read")}
                    size="small"
                    sx={{
                      textTransform: "none",
                      fontSize: { xs: "0.75rem", md: "0.875rem" },
                      minWidth: { xs: "auto", md: "64px" },
                      px: { xs: 0.5, md: 1 },
                      "& .MuiButton-endIcon": {
                        ml: { xs: 0, md: 0.5 }
                      }
                    }}
                  >
                    <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>View All</Box>
                  </Button>
                </Box>
                {isLoadingRecentlyRead && <Loading />}
                {recentlyReadError && (
                  <Typography color="error">Failed to load recently read items</Typography>
                )}
                {!isLoadingRecentlyRead &&
                  !recentlyReadError &&
                  renderPageList(recentlyReadPages || [], "No recently read items yet.")}
              </Box>
            </Box>

            <Box sx={columnSx}>
              <Box sx={moduleSx}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    pb: { xs: 1, md: 1.5 },
                    borderBottom: "1px solid",
                    borderColor: "rgba(0,0,0,0.06)",
                    mb: { xs: 2, md: 2.5 },
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: "1rem", md: "1.25rem" } }}>
                    Read Later
                  </Typography>
                  <Button
                    endIcon={<ArrowForwardIcon sx={{ fontSize: { xs: "1.25rem", md: "1.25rem" } }} />}
                    onClick={handleViewAll("/later")}
                    size="small"
                    sx={{
                      textTransform: "none",
                      fontSize: { xs: "0.75rem", md: "0.875rem" },
                      minWidth: { xs: "auto", md: "64px" },
                      px: { xs: 0.5, md: 1 },
                      "& .MuiButton-endIcon": {
                        ml: { xs: 0, md: 0.5 }
                      }
                    }}
                  >
                    <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>View All</Box>
                  </Button>
                </Box>
                {isLoadingReadLater && <Loading />}
                {readLaterError && (
                  <Typography color="error">Failed to load read later items</Typography>
                )}
                {!isLoadingReadLater &&
                  !readLaterError &&
                  renderPageList(readLaterPages || [], "No read later items yet.")}
              </Box>

              <Box sx={moduleSx}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    pb: { xs: 1, md: 1.5 },
                    borderBottom: "1px solid",
                    borderColor: "rgba(0,0,0,0.06)",
                    mb: { xs: 2, md: 2.5 },
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: "1rem", md: "1.25rem" } }}>
                    Highlights
                  </Typography>
                  <Button
                    endIcon={<ArrowForwardIcon sx={{ fontSize: { xs: "1.25rem", md: "1.25rem" } }} />}
                    onClick={handleViewAll("/highlights")}
                    size="small"
                    sx={{
                      textTransform: "none",
                      fontSize: { xs: "0.75rem", md: "0.875rem" },
                      minWidth: { xs: "auto", md: "64px" },
                      px: { xs: 0.5, md: 1 },
                      "& .MuiButton-endIcon": {
                        ml: { xs: 0, md: 0.5 }
                      }
                    }}
                  >
                    <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>View All</Box>
                  </Button>
                </Box>
                {isLoadingHighlights && <Loading />}
                {highlightsError && (
                  <Typography color="error">Failed to load highlights</Typography>
                )}
                {!isLoadingHighlights && !highlightsError && renderHighlights(highlights || [])}
              </Box>

              <Box sx={moduleSx}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    pb: { xs: 1, md: 1.5 },
                    borderBottom: "1px solid",
                    borderColor: "rgba(0,0,0,0.06)",
                    mb: { xs: 2, md: 2.5 },
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: "1rem", md: "1.25rem" } }}>
                    Huntly Info
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: { xs: 1.5, md: 2 }, justifyContent: "space-between" }}>
                  {/* Version */}
                  <Box sx={{ flex: 1, textAlign: "center" }}>
                    <Box
                      sx={{
                        width: { xs: 36, md: 48 },
                        height: { xs: 36, md: 48 },
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 2,
                        backgroundColor: "rgba(25, 118, 210, 0.1)",
                        color: "primary.main",
                        mx: "auto",
                        mb: { xs: 1, md: 1.5 },
                      }}
                    >
                      <InfoIcon sx={{ fontSize: { xs: 18, md: 24 } }} />
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: { xs: "0.75rem", md: "0.875rem" } }}>
                      Version
                    </Typography>
                    <Button
                      href="https://github.com/lcomplete/huntly/releases"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      sx={{
                        textTransform: "none",
                        p: 0,
                        minWidth: 0,
                        fontSize: "0.875rem",
                        fontWeight: 400,
                        color: "primary.main",
                        "&:hover": {
                          backgroundColor: "transparent",
                          textDecoration: "underline",
                        },
                      }}
                    >
                      v0.5.1
                    </Button>
                  </Box>

                  {/* Chrome Extension */}
                  <Box sx={{ flex: 1, textAlign: "center" }}>
                    <Box
                      sx={{
                        width: { xs: 36, md: 48 },
                        height: { xs: 36, md: 48 },
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 2,
                        backgroundColor: "rgba(25, 118, 210, 0.1)",
                        color: "primary.main",
                        mx: "auto",
                        mb: { xs: 1, md: 1.5 },
                      }}
                    >
                      <ExtensionIcon sx={{ fontSize: { xs: 18, md: 24 } }} />
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: { xs: "0.75rem", md: "0.875rem" } }}>
                      Extension
                    </Typography>
                    <Button
                      href="https://chromewebstore.google.com/detail/huntly/cphlcmmpbdkadofgcedjgfblmiklbokm"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      sx={{
                        textTransform: "none",
                        p: 0,
                        minWidth: 0,
                        fontSize: "0.875rem",
                        fontWeight: 400,
                        color: "primary.main",
                        "&:hover": {
                          backgroundColor: "transparent",
                          textDecoration: "underline",
                        },
                      }}
                    >
                      Install
                    </Button>
                  </Box>

                  {/* GitHub */}
                  <Box sx={{ flex: 1, textAlign: "center" }}>
                    <Box
                      sx={{
                        width: { xs: 36, md: 48 },
                        height: { xs: 36, md: 48 },
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 2,
                        backgroundColor: "rgba(0, 0, 0, 0.05)",
                        color: "text.primary",
                        mx: "auto",
                        mb: { xs: 1, md: 1.5 },
                      }}
                    >
                      <GitHubIcon sx={{ fontSize: { xs: 18, md: 24 } }} />
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: { xs: "0.75rem", md: "0.875rem" } }}>
                      GitHub
                    </Typography>
                    <Button
                      href="https://github.com/lcomplete/huntly"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      sx={{
                        textTransform: "none",
                        p: 0,
                        minWidth: 0,
                        fontSize: "0.875rem",
                        fontWeight: 400,
                        color: "primary.main",
                        "&:hover": {
                          backgroundColor: "transparent",
                          textDecoration: "underline",
                        },
                      }}
                    >
                      Star
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box sx={columnSx}>
              <Box sx={moduleSx}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    pb: { xs: 1, md: 1.5 },
                    borderBottom: "1px solid",
                    borderColor: "rgba(0,0,0,0.06)",
                    mb: { xs: 2, md: 2.5 },
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: "1rem", md: "1.25rem" } }}>
                    24h Hot Tweets
                  </Typography>
                  <Button
                    endIcon={<ArrowForwardIcon sx={{ fontSize: { xs: "1.25rem", md: "1.25rem" } }} />}
                    onClick={handleViewAll("/twitter")}
                    size="small"
                    sx={{
                      textTransform: "none",
                      fontSize: { xs: "0.75rem", md: "0.875rem" },
                      minWidth: { xs: "auto", md: "64px" },
                      px: { xs: 0.5, md: 1 },
                      "& .MuiButton-endIcon": {
                        ml: { xs: 0, md: 0.5 }
                      }
                    }}
                  >
                    <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>View All</Box>
                  </Button>
                </Box>
                <Box
                  sx={{
                    maxHeight: { xs: "none", md: "calc(100vh - 180px)" },
                    overflowY: { xs: "visible", md: "auto" },
                    pr: { md: 1 },
                  }}
                >
                  {isLoadingHotTweets && <Loading />}
                  {hotTweetsError && (
                    <Typography color="error">Failed to load hot tweets</Typography>
                  )}
                  {!isLoadingHotTweets &&
                    !hotTweetsError &&
                    renderPageList(hotTweets || [], "No hot tweets in the last 24h.", true)}
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </MainContainer>
  );
};

export default Home;
