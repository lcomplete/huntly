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
import Loading from "../components/Loading";
import { Link, useNavigate } from "react-router-dom";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SubHeader from "../components/SubHeader";
import navLabels from "../components/Sidebar/NavLabels";
import moment from "moment";
import { ConnectorType } from "../interfaces/connectorType";
import SmartMoment from "../components/SmartMoment";

const Home = () => {
  const navigate = useNavigate();
  const hotTweetsDateRange = React.useMemo(() => {
    const endDate = moment().format("YYYY-MM-DD");
    const startDate = moment().subtract(1, "day").format("YYYY-MM-DD");
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
      5, // count
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
      5, // count
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
      5, // count
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
      5,
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
      undefined, // contentFilterType
      "TWEET", // contentType
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
    borderRadius: 2,
    border: "1px solid",
    borderColor: "divider",
    backgroundColor: "action.hover",
    padding: { xs: 2, md: 2.5 },
    display: "flex",
    flexDirection: "column",
    gap: 3,
  };

  const moduleSx = {
    p: 2,
    borderRadius: 2,
    border: "1px solid",
    borderColor: "divider",
    backgroundColor: "background.paper",
    boxShadow: 1,
  };

  const renderPageList = (pages: PageItem[], emptyText: string) => {
    if (!pages || pages.length === 0) {
      return (
        <Box sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
          <Typography variant="body2">{emptyText}</Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {pages.map((page: PageItem) => (
          <MagazineItem key={page.id} page={page} />
        ))}
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
                border: "1px solid",
                borderColor: "divider",
                backgroundColor: "action.hover",
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
      />
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Box sx={{ width: "100%" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "33.33% 33.33% 33.33%",
              },
              gap: { xs: 3, md: 3 },
            }}
          >
            <Box sx={columnSx}>
              <Box sx={moduleSx}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    pb: 1.5,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    mb: 2.5,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Latest Feed
                  </Typography>
                  <Button
                    endIcon={<ArrowForwardIcon />}
                    onClick={handleViewAll("/feeds")}
                    size="small"
                    sx={{ textTransform: "none" }}
                  >
                    View All
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
                    pb: 1.5,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    mb: 2.5,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Recently Read
                  </Typography>
                  <Button
                    endIcon={<ArrowForwardIcon />}
                    onClick={handleViewAll("/recently-read")}
                    size="small"
                    sx={{ textTransform: "none" }}
                  >
                    View All
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
                    pb: 1.5,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    mb: 2.5,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Read Later
                  </Typography>
                  <Button
                    endIcon={<ArrowForwardIcon />}
                    onClick={handleViewAll("/later")}
                    size="small"
                    sx={{ textTransform: "none" }}
                  >
                    View All
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
                    pb: 1.5,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    mb: 2.5,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Highlights
                  </Typography>
                  <Button
                    endIcon={<ArrowForwardIcon />}
                    onClick={handleViewAll("/highlights")}
                    size="small"
                    sx={{ textTransform: "none" }}
                  >
                    View All
                  </Button>
                </Box>
                {isLoadingHighlights && <Loading />}
                {highlightsError && (
                  <Typography color="error">Failed to load highlights</Typography>
                )}
                {!isLoadingHighlights && !highlightsError && renderHighlights(highlights || [])}
              </Box>
            </Box>

            <Box sx={columnSx}>
              <Box sx={moduleSx}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    pb: 1.5,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    mb: 2.5,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    24h Hot Tweets
                  </Typography>
                  <Button
                    endIcon={<ArrowForwardIcon />}
                    onClick={handleViewAll("/twitter")}
                    size="small"
                    sx={{ textTransform: "none" }}
                  >
                    View All
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
                    renderPageList(hotTweets || [], "No hot tweets in the last 24h.")}
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
