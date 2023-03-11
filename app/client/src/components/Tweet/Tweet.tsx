import CardMedia from "@mui/material/CardMedia";
import SmartMoment from "../SmartMoment";
import * as React from "react";
import {TweetProperties} from "../../interfaces/tweetProperties";
import {PageItem} from "../../api";
import styles from './Tweet.module.css';
import {PhotoProvider, PhotoView} from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import {Player, ControlBar, BigPlayButton} from 'video-react';
import DownloadButton from './DownloadButton';
import 'video-react/dist/video-react.css';
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import ArticleIcon from '@mui/icons-material/Article';

export default function Tweet({
                                tweetProps,
                                page,
                                isInQuote
                              }: { tweetProps: TweetProperties, page: PageItem, isInQuote?: boolean }) {
  let imageStyles = {};
  if (tweetProps.medias) {
    if (tweetProps.medias.length > 2) {
      imageStyles = {height: 180, width: isInQuote ? 280 : 320, mt: 1};
    } else if (tweetProps.medias.length === 2) {
      imageStyles = {height: isInQuote ? 300 : 330, width: isInQuote ? 280 : 320};
    } else {
      if (tweetProps.medias[0].rawSize.width > tweetProps.medias[0].rawSize.height) {
        imageStyles = {maxWidth: 530};
      } else {
        imageStyles = {maxHeight: 530, maxWidth: 530};
      }
    }
  }
  const hasVideo = tweetProps.medias && tweetProps.medias.some((media) => {
    return media.type === 'video';
  });
  const videoMedia = hasVideo ? tweetProps.medias.filter((media) => {
    return media.type === 'video';
  })[0] : null;
  const maxBitrateVideo = videoMedia ? videoMedia.videoInfo.variants.sort((a, b) => {
    return b.bitrate - a.bitrate;
  })[0] : null;
  const normalBitrateVideo = videoMedia ? videoMedia.videoInfo.variants.filter((variant) => {
    return variant.bitrate < 1000000;
  }).sort((a, b) => {
    return b.bitrate - a.bitrate;
  })[0] : null;


  // mentions
  let userMentions = tweetProps.userMentions;
  let replyMentions = [];
  let mentionIndexStart = 0;
  if (userMentions && userMentions.length > 0) {
    userMentions.forEach((userMention) => {
      if (userMention.indices[0] === mentionIndexStart) {
        replyMentions.push(userMention);
        mentionIndexStart = userMention.indices[1] + 1;
      }
    })
  }
  // remove replyMentions in userMentions
  if (replyMentions.length > 0) {
    userMentions = userMentions.filter((userMention) => {
      return !replyMentions.includes(userMention);
    })
  }

  let fullTextArr = Array.from(tweetProps.fullText);
  let renderText = '';
  let indexMap = {};

  if (tweetProps.hashtags && tweetProps.hashtags.length > 0) {
    tweetProps.hashtags.forEach((hashtag) => {
      indexMap[hashtag.indices[0]] = [hashtag.indices[1], `<a href="https://twitter.com/hashtag/${hashtag.text}" target="_blank">#${hashtag.text}</a>`];
    });
  }
  if (tweetProps.urls && tweetProps.urls.length > 0) {
    tweetProps.urls.forEach((url) => {
      indexMap[url.indices[0]] = [url.indices[1], `<a href="${url.expandedUrl}" target="_blank">${url.displayUrl}</a>`];
    });
  }
  if (tweetProps.medias && tweetProps.medias.length > 0) {
    tweetProps.medias.forEach((media) => {
      if (media.type === 'video' && media.indices && media.indices.length === 2) {
        indexMap[media.indices[0]] = [media.indices[1], ``];
      }
    });
  }
  if (userMentions && userMentions.length > 0) {
    userMentions.forEach((userMention) => {
      indexMap[userMention.indices[0]] = [userMention.indices[1], `<a href="https://twitter.com/${userMention.screenName}" target="_blank">@${userMention.screenName}</a>`];
    });
  }
  let index = 0, lastIndex = 0;
  for (index = 0; index < fullTextArr.length; ++index) {
    if (tweetProps.displayTextRange && tweetProps.displayTextRange.length > 0 && (index < tweetProps.displayTextRange[0])) {
      lastIndex = index + 1;
      continue;
    }
    const map = indexMap[index];
    if (map) {
      const end = map[0];
      const html = map[1];
      if (index > lastIndex) {
        renderText += fullTextArr.slice(lastIndex, index).join('');
      }
      renderText += html;
      index = end - 1;
      lastIndex = end;
    }
  }
  if (index > lastIndex) {
    if (tweetProps.displayTextRange && tweetProps.displayTextRange.length > 0) {
      index = tweetProps.displayTextRange[1];
    }
    renderText += fullTextArr.slice(lastIndex, index).join('');
  }

  function handleClick(e) {
    const selection = window.getSelection();
    if (selection.toString().length > 0 || e.target.tagName === 'A' || e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO'
      || e.target.tagName === 'BUTTON' || e.target.className === 'video-react-poster'
      || e.target.className.indexOf('video-react') > -1
    ) {
      return;
    }
    window.open(tweetProps.url, '_blank');
  }

  return <div className={`flex ${styles.mainSize} cursor-pointer`} onClick={handleClick}>
    <div>
      <a href={`https://twitter.com/${tweetProps.userScreeName}`} target={'_blank'}>
        <CardMedia component={'img'} image={tweetProps.userProfileImageUrl} sx={{
          width: 48, height: 48, borderRadius: 9999
        }}/>
      </a>
    </div>
    <div className={'ml-2 grow'}>
      <span className={`font-bold ${styles.mainColor}`}>
        <a href={`https://twitter.com/${tweetProps.userScreeName}`} target={'_blank'}>{tweetProps.userName}</a>
      </span>
      <span className={`ml-1 ${styles.secondaryColor}`}>
        <a href={`https://twitter.com/${tweetProps.userScreeName}`} target={'_blank'}>@{tweetProps.userScreeName}</a>
      </span>
      <span className={`mr-1 ml-1 ${styles.secondaryColor}`}>·</span>
      <span className={styles.secondaryColor}><a href={tweetProps.url} target={'_blank'}><SmartMoment
        dt={tweetProps.createdAt}></SmartMoment></a></span>
      <div className={`text-[14px] ${styles.tweet}`}>
        {
          replyMentions && replyMentions.length > 0 && <div className={'flex flex-wrap mb-1'}>
            <span className={styles.secondaryColor}>回复</span>
            {
              replyMentions.map(mention => {
                return <a href={"https://twitter.com/" + mention.screenName} key={'reply-' + mention.screenName}
                          className={`mr-1 ml-1 ${styles.mainLink}`}>@{mention.screenName}</a>
              })
            }
          </div>
        }
        <pre className={`break-all break-words whitespace-pre-wrap mt-0 mb-1`}
             dangerouslySetInnerHTML={{__html: renderText}}></pre>
        {
          !hasVideo && tweetProps.medias && <div className={'flex justify-between flex-wrap '}>
            <PhotoProvider maskOpacity={0.8}>
              {
                tweetProps.medias.map(media => {
                  return <div key={'media-' + media.mediaUrl}>
                    <PhotoView src={media.mediaUrl + "?name=large"}>
                      <CardMedia className={`${styles.mainBorder}`}
                                 component={'img'}
                                 image={media.mediaUrl} sx={imageStyles}/>
                    </PhotoView>
                  </div>
                })
              }
      </PhotoProvider>
    </div>
    }
    {
      hasVideo && <div>
        <Player src={normalBitrateVideo.url} poster={videoMedia.mediaUrl}
                fluid={videoMedia.videoInfo.aspectRatio[0] > videoMedia.videoInfo.aspectRatio[1]}
        >
          <BigPlayButton position="center"/>
          <ControlBar autoHide={true}>
            <DownloadButton src={maxBitrateVideo.url} order={7}/>
          </ControlBar>
        </Player>
      </div>
    }
    {
      tweetProps.card && (tweetProps.card.type === "summary_large_image" || tweetProps.card.type === "summary") && tweetProps.card.url &&
      <div>
        {
          tweetProps.card.type === "summary_large_image" &&
          <a href={tweetProps.card.url} target={'_blank'} className={styles.cardLink}>
            <Card className={`${styles.mainBorder} mt-2 w-11/12`}>
              <CardActionArea>
                <CardMedia
                  component="img"
                  height={260}
                  image={tweetProps.card.imageUrl}
                  alt={tweetProps.card.title}
                />
                <CardContent sx={{borderTop: '1px solid #ccc', pt: 1}}>
                  <Typography variant="body2" color="text.secondary">
                    {tweetProps.card.domain}
                  </Typography>
                  <Typography variant="body1" component="div">
                    {tweetProps.card.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" className={`line-clamp-2`}>
                    {tweetProps.card.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </a>
        }
        {
          tweetProps.card.type !== "summary_large_image" &&
          <a href={tweetProps.card.url} target={'_blank'} className={styles.cardLink}>
            <Card className={`${styles.mainBorder} mt-2 flex mr-4`}>
              {
                tweetProps.card.thumbnailImageUrl &&
                <div className={'w-[130px] flex items-center shrink-0'} style={{backgroundColor: 'rgb(247,249,249)'}}>
                  <CardMedia
                    component="img"
                    height={130}
                    image={tweetProps.card.thumbnailImageUrl}
                    alt={tweetProps.card.title}
                  />
                </div>
              }
              {
                !tweetProps.card.thumbnailImageUrl &&
                <div className={'w-[130px] flex items-center shrink-0'} style={{backgroundColor: 'rgb(247,249,249)'}}>
                  <CardMedia
                    component={ArticleIcon}
                    className={'grow'}
                  />
                </div>
              }
              <div className={'flex items-center'}>
                <CardContent sx={{borderLeft: '1px solid #ccc'}}>
                  <Typography variant="body2" color="text.secondary">
                    {tweetProps.card.domain}
                  </Typography>
                  <Typography variant="body1" component="div">
                    {tweetProps.card.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" className={`line-clamp-2`}>
                    {tweetProps.card.description}
                  </Typography>
                </CardContent>
              </div>
            </Card>
          </a>
        }
      </div>
    }
    {
      // quoted tweet use border round style
      tweetProps.quotedTweet && <div className={`${styles.mainBorder} p-3 mt-3`}>
        <Tweet tweetProps={tweetProps.quotedTweet} page={page} isInQuote={true}/>
      </div>
    }
  </div>
</div>
</div>
}