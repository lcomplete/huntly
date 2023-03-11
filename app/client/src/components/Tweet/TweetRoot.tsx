import CardMedia from "@mui/material/CardMedia";
import * as React from "react";
import Tweet from "./Tweet";
import {TweetProperties} from "../../interfaces/tweetProperties";
import {PageItem} from "../../api";
import RepeatIcon from "@mui/icons-material/Repeat";
import styles from './Tweet.module.css';

export default function TweetRoot({tweetProps, page}: { tweetProps: TweetProperties, page: PageItem }) {
  const tweet = tweetProps.retweetedTweet || tweetProps;
  return <div>
    {
      tweetProps.retweetedTweet && <div className={`flex items-center font-bold text-[14px] ${styles.secondaryColor} mb-1`}>
        <span className={"ml-8 mr-2"}>
                    <CardMedia component={RepeatIcon}
                               sx={{
                                 width: 16, height: 16
                               }}/>
                  </span>
        <a href={tweetProps.url} target={"_blank"}>{tweetProps.userName} 已转推</a>
      </div>
    }
    <div className={'mb-2'}><Tweet tweetProps={tweet} page={page}/></div>
  </div>
}