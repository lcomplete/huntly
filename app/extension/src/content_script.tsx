console.log("content script loaded");

// 在页面上插入代码，这样插入的代码才能访问页面中的 window 等全局变量
const script = document.createElement('script');
script.setAttribute('type', 'text/javascript');
script.setAttribute('src', chrome.runtime.getURL('/js/tweet_interceptor.js'));
document.documentElement.appendChild(script);

window.addEventListener("message",function(event:MessageEvent<Message>){
  chrome.runtime.sendMessage(event.data);
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.color) {
    console.log("Receive color = " + msg.color);
    document.body.style.backgroundColor = msg.color;
    sendResponse("Change color to " + msg.color);
  } else {
    sendResponse("Color message is none.");
  }
});