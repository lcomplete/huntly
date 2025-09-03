const RawRequest = {
  originalOpen: XMLHttpRequest.prototype.open,
}

export class RequestInterceptor {

  enable(responseHandler: (responseText: string, responseUrl: string) => void) {
    // 重写 XMLHttpRequest.prototype.open 方法
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, async?: boolean, user?: string | null, password?: string | null) {
      // 添加 readystatechange 监听器
      this.addEventListener('readystatechange', function() {
        if (this.readyState === 4 && 
            (this.responseType === 'json' || this.responseType === 'text' || this.responseType === '')) {
          try {
            responseHandler(this.responseText, this.responseURL);
          } catch (error) {
            console.warn('RequestInterceptor handler error:', error);
          }
        }
      }, { once: true });

      // 调用原始的 open 方法
      return RawRequest.originalOpen.apply(this, arguments);
    };
  }

  disable() {
    // 恢复原始的 open 方法
    XMLHttpRequest.prototype.open = RawRequest.originalOpen;
  }
}

