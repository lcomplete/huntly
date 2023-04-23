import * as React from 'react';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import {Box} from '@mui/material';
import {Link} from "react-router-dom";
import {PageItem} from "../api";
import SmartMoment from "./SmartMoment";
import PageOperationButtons, {PageOperateEvent} from "./PageOperationButtons";
import {useState} from "react";
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
  const isGithub = page.connectorType === ConnectorType.GITHUB;
  let tweetProps: TweetProperties = isTweet ? JSON.parse(page.pageJsonProperties) : null;
  let tweetStatus = tweetProps;
  if (tweetProps && tweetProps.retweetedTweet) {
    tweetStatus = tweetProps.retweetedTweet;
  }
  let repoProps: GithubRepoProperties = isGithub && page.pageJsonProperties != null ? JSON.parse(page.pageJsonProperties) : null;

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
      <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: ''}}>
        <Box className={"grow flex flex-col self-center"}>
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

          <Box sx={{}} className={"flex items-center justify-between mt-1 text-[15px]"}>
            <div className={'flex text-gray-500 items-center'}>
              <a href={page.url} target={"_blank"} className={'hover:underline'}>
                <div className={"flex items-center flex-wrap"}>
                  {page.faviconUrl &&
                    <span className={"mr-2"}>
                        <CardMedia component={'img'} image={page.faviconUrl}
                                   sx={{
                                     width: 16, height: 16
                                   }}/>
                    </span>
                  }
                  {
                    !page.faviconUrl && isTweet && <span className={"mr-2 ml-2"}><CardMedia component={TwitterIcon}
                                                                                            sx={{
                                                                                              width: 16,
                                                                                              height: 16,
                                                                                              color: 'rgb(29, 155, 240)'
                                                                                            }}/>
                  </span>
                  }
                  {
                    !page.faviconUrl && !isTweet && page.connectorType === 2 &&
                    <span className={"mr-2"}><CardMedia component={GitHubIcon}
                                                        sx={{
                                                          width: 16,
                                                          height: 16,
                                                          color: 'rgb(24, 23, 23)'
                                                        }}/>
                  </span>
                  }
                  {!isTweet && <React.Fragment>
                    <Typography variant={"body2"} color={"text.secondary"} component={"span"}
                                className={'flex'}>
                      <span className={"max-w-[260px] text-ellipsis break-all whitespace-nowrap overflow-hidden"}>
                       {
                         page.siteName || page.domain
                       }
                      </span>
                      <span className={"mr-1 ml-1"}>·</span>
                    </Typography>
                  </React.Fragment>
                  }
                  <SmartMoment dt={page.recordAt}></SmartMoment>
                </div>
              </a>

              {isTweet &&
                <div className={'flex items-center'}>
                  <span className={"ml-4"}>
                    <CardMedia component={ChatBubbleOutlineIcon}
                               sx={{
                                 width: 16, height: 16
                               }}/>
                  </span>
                  <span className={'ml-2'}>{tweetStatus.replyCount}</span>
                  <span className={"ml-3"}>
                    <CardMedia component={RepeatIcon}
                               sx={{
                                 width: 16, height: 16
                               }}/>
                  </span>
                  <span className={'ml-2'}>{tweetStatus.retweetCount}</span>
                  <span className={"ml-3"}>
                    <CardMedia component={FavoriteBorderIcon}
                               sx={{
                                 width: 16, height: 16
                               }}/>
                  </span>
                  <span className={'ml-2'}>{tweetStatus.favoriteCount}</span>
                  {
                    tweetProps.viewCount > 0 && <React.Fragment>
                  <span className={"ml-3"}>
                    <CardMedia component={BarChartIcon}
                               sx={{
                                 width: 16, height: 16
                               }}/>
                  </span>
                      <span className={'ml-2'}>{tweetStatus.viewCount}</span>
                    </React.Fragment>
                  }
                </div>
              }
              {isGithub && repoProps &&
                <div className={'flex items-center'}>
                  <span className={"ml-4"}>
                    <CardMedia component={StarOutlineIcon}
                               sx={{
                                 width: 16, height: 16
                               }}/>
                  </span>
                  <span className={'ml-2'}>{repoProps.stargazersCount}</span>
                  <span className={"ml-3"}>
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
              librarySaveStatus: page.librarySaveStatus
            }} onOperateSuccess={onOperateSuccess}/>
          </Box>
        </Box>

        {page.thumbUrl &&
          <Link to={`/page/${page.id}`} className={'self-center'} onClick={(e) => onPageSelect(e, page.id)}>
            <Box className={'page-item-thumb'} sx={{width: 160, height: 120, flexShrink: 0, marginLeft: 2}}>
              <CardMedia
                component="img"
                sx={{width: '100%', height: '100%'}}
                image={page.thumbUrl}
                alt={page.title}
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
