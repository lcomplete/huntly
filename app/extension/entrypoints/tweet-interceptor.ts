import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";
import { initTweetInterceptor } from "../src/tweet_interceptor";

export default defineUnlistedScript(() => {
  initTweetInterceptor();
});
