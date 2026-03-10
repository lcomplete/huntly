const RawRequest = {
  originalOpen: XMLHttpRequest.prototype.open,
}

export class RequestInterceptor {

  enable(responseHandler: (responseText: string, responseUrl: string) => void) {
    // 重写 XMLHttpRequest.prototype.open 方法
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, async?: boolean, user?: string | null, password?: string | null) {
      // 添加 load 监听器
      this.addEventListener('load', function() {
        if (this.responseType === 'json' || this.responseType === 'text' || this.responseType === '') {
          try {
            // 当 responseType='json' 时，responseText 不可访问，需要使用 response 属性
            let responseText;
            if (this.responseType === 'json') {
              responseText = typeof this.response === 'string'
                ? this.response
                : JSON.stringify(this.response);
            } else {
              responseText = this.responseText;
            }
            responseHandler(responseText, this.responseURL);
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

