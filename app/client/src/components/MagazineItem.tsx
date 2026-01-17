import * as React from 'react';
import "./MagazineItem.css";
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import {Box} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import {Link} from "react-router-dom";
import {PageItem} from "../api";
import SmartMoment from "./SmartMoment";
import PageOperationButtons, {PageOperateEvent} from "./PageOperationButtons";
import {useState, useEffect} from "react";
import TwitterIcon from '@mui/icons-material/Twitter';
import {TweetProperties} from "../interfaces/tweetProperties";
import TweetRoot from "./Tweet/TweetRoot";
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import RepeatIcon from '@mui/icons-material/Repeat';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import BarChartIcon from '@mui/icons-material/BarChart';
import GitHubIcon from "@mui/icons-material/GitHub";
import {ConnectorType} from "../interfaces/connectorType";
import {GithubRepoProperties} from "../interfaces/githubRepoProperties";
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import TextSnippetOutlinedIcon from '@mui/icons-material/TextSnippetOutlined';
import AltRouteIcon from '@mui/icons-material/AltRoute';

type MagazineItemProps = {
  page: PageItem,
  onOperateSuccess?: (event: PageOperateEvent) => void,
  onPageSelect?: (event: any, id: number) => void,
  showMarkReadOption?: boolean,
  currentVisit?: boolean
}

export default function MagazineItem({
                                       page,
                                       onOperateSuccess,
                                       onPageSelect,
                                       showMarkReadOption, // todo
                                       currentVisit,
                                     }: MagazineItemProps) {

  const [readed, setReaded] = useState(page.markRead);
  const isTweet = page.contentType === 1 || page.contentType === 3;
  const isSnippet = page.contentType === 4;
  const isGithub = page.connectorType === ConnectorType.GITHUB;
  const isMobile = useMediaQuery('(max-width:600px)');

  const handleFaviconError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = '/fallback-icon.svg';
  };

  const handleThumbError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = '/fallback-thumb.svg';
  };
  let tweetProps: TweetProperties = isTweet ? JSON.parse(page.pageJsonProperties) : null;
  let tweetStatus = tweetProps;
  if (tweetProps && tweetProps.retweetedTweet) {
    tweetStatus = tweetProps.retweetedTweet;
  }
  let repoProps: GithubRepoProperties = isGithub && page.pageJsonProperties != null ? JSON.parse(page.pageJsonProperties) : null;

  // Update local state when page.markRead changes
  useEffect(() => {
    setReaded(page.markRead);
  }, [page.markRead]);

  function pageSelect(e: React.MouseEvent<HTMLAnchorElement>, id: number) {
    setReaded(true);
    if (onPageSelect) {
      onPageSelect(e, id);
    }
  }

  return (
    <Box
      className={`w-full pt-3 pl-2 pr-2 hover:bg-blue-50 ${currentVisit ? "shadow shadow-blue-300 bg-blue-50" : ""}`}
      key={page.id}
    >
      <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1}}>
        <Box className={"grow flex flex-col self-center"} sx={{ minWidth: 0 }}>
          {
            !isTweet &&
            <Link to={`/page/${page.id}`} onClick={(e) => pageSelect(e, page.id)}>
              <Box className={""}>
                <Typography gutterBottom variant="subtitle1"
                            className={`line-clamp-2 font-bold break-all ${readed && showMarkReadOption ? "text-neutral-500" : ""}`}>
                  {page.title}
                </Typography>
                <Typography variant="body2" color="text.secondary"
                            className={`line-clamp-3 break-all  ${readed && showMarkReadOption ? "text-neutral-400" : ""}`}
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: "rgba(41,41,41,1)"
                            }}>
                  {page.description}
                </Typography>
              </Box>
            </Link>
          }

          {
            isTweet && <TweetRoot tweetProps={tweetProps} page={page}/>
          }

          <Box sx={{}} className={"flex items-center mt-1 text-[15px] magazine-item-meta"}>
            <div className={'flex text-gray-500 items-center min-w-0 flex-1'}>
              <a href={page.url} target={"_blank"} className={'hover:underline min-w-0'}>
                <div className={"flex items-center flex-wrap"}>
                  {page.faviconUrl &&
                    <span className={"mr-2 flex-shrink-0"}>
                        <CardMedia component={'img'} image={page.faviconUrl}
                                   onError={handleFaviconError}
                                   sx={{
                                     width: 16, height: 16
                                   }}/>
                    </span>
                  }
                  {
                    !page.faviconUrl && isTweet && <span className={"mr-2 ml-2 flex-shrink-0"}><CardMedia component={TwitterIcon}
                                                                                            sx={{
                                                                                              width: 16,
                                                                                              height: 16,
                                                                                              color: 'rgb(29, 155, 240)'
                                                                                            }}/>
                  </span>
                  }
                  {
                    !page.faviconUrl && !isTweet && page.connectorType === 2 && !isMobile &&
                    <span className={"mr-2 flex-shrink-0"}><CardMedia component={GitHubIcon}
                                                         sx={{
                                                           width: 16,
                                                           height: 16,
                                                           color: 'rgb(24, 23, 23)'
                                                         }}/>
                   </span>
                  }

                  {!isTweet && <React.Fragment>
                    <Typography variant={"body2"} color={"text.secondary"} component={"span"}
                                className={'flex min-w-0'}>
                      <span className={"max-w-[260px] magazine-item-site-name text-ellipsis break-all whitespace-nowrap overflow-hidden"}>
                       {
                         page.siteName || page.domain
                       }
                      </span>
                      <span className={"mr-1 ml-1 flex-shrink-0"}>·</span>
                    </Typography>
                  </React.Fragment>
                  }
                  <SmartMoment dt={page.recordAt}></SmartMoment>
                </div>
              </a>

              {isTweet &&
                <div className={'flex items-center flex-wrap magazine-item-stats'}>
                  <span className={"ml-4 sm:ml-3 flex-shrink-0 tweet-stat-reply hidden sm:flex items-center"}>
                    <CardMedia component={ChatBubbleOutlineIcon}
                               sx={{
                                 width: 16, height: 16
                               }}/>
                    <span className={'ml-1'}>{tweetStatus.replyCount}</span>
                  </span>
                  <span className={"sm:ml-3 flex-shrink-0 tweet-stat-retweet hidden sm:flex items-center"}>
                    <CardMedia component={RepeatIcon}
                               sx={{
                                 width: 16, height: 16
                               }}/>
                    <span className={'ml-1'}>{tweetStatus.retweetCount + (tweetStatus.quoteCount || 0)}</span>
                  </span>
                  <span className={"ml-4 sm:ml-3 flex-shrink-0 tweet-stat-like flex items-center"}>
                    <CardMedia component={FavoriteBorderIcon}
                               sx={{
                                 width: 16, height: 16
                               }}/>
                    <span className={'ml-1'}>{tweetStatus.favoriteCount}</span>
                  </span>
                  {
                    tweetProps.viewCount > 0 &&
                  <span className={"sm:ml-3 flex-shrink-0 tweet-stat-view hidden sm:flex items-center"}>
                    <CardMedia component={BarChartIcon}
                               sx={{
                                 width: 16, height: 16
                               }}/>
                    <span className={'ml-1'}>{tweetStatus.viewCount}</span>
                  </span>
                  }
                </div>
              }
              {isGithub && repoProps && !isMobile &&
                <div className={'flex items-center flex-wrap magazine-item-stats'}>
                  <span className={"ml-4 flex-shrink-0"}>
                    <CardMedia component={StarOutlineIcon}
                               sx={{
                                 width: 16, height: 16
                               }}/>
                  </span>
                  <span className={'ml-2'}>{repoProps.stargazersCount}</span>
                  <span className={"ml-3 flex-shrink-0"}>
                    <CardMedia component={AltRouteIcon}
                               sx={{
                                 width: 16, height: 16
                               }}/>
                  </span>
                  <span className={'ml-2'}>{repoProps.forksCount}</span>
                </div>
              }
            </div>

            <PageOperationButtons pageStatus={{
              id: page.id,
              starred: page.starred,
              readLater: page.readLater,
              librarySaveStatus: page.librarySaveStatus,
              collectionId: page.collectionId
            }} onOperateSuccess={onOperateSuccess}/>
          </Box>
        </Box>

        {isSnippet &&
          <Link to={`/page/${page.id}`} className={'self-center'} onClick={(e) => onPageSelect(e, page.id)}>
            <Box className={'page-item-thumb flex flex-col items-center justify-center bg-gray-50'} sx={{width: 160, height: 120, flexShrink: 0, marginLeft: 2, borderRadius: 2}}>
              <TextSnippetOutlinedIcon sx={{ fontSize: 28, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontSize: 12 }}>
                snippet
              </Typography>
            </Box>
          </Link>
        }
        {page.thumbUrl && !isSnippet &&
          <Link to={`/page/${page.id}`} className={'self-center'} onClick={(e) => onPageSelect(e, page.id)}>
            <Box className={'page-item-thumb'} sx={{width: 160, height: 120, flexShrink: 0, marginLeft: 2}}>
              <CardMedia
                component="img"
                sx={{width: '100%', height: '100%'}}
                image={page.thumbUrl}
                alt={page.title}
                onError={handleThumbError}
              />
            </Box>
          </Link>
        }
      </Box>

      <Box component={"hr"} sx={{
        "background-color": "rgba(230, 230, 230, 1)",
        border: 0,
        height: '1px'
      }} className={"mt-3 mb-0"}/>

    </Box>
  );
}
