const RawRequest = {
  originalXHR: window.XMLHttpRequest,
  originalFetch: window.fetch.bind(window),
}

function customXHR(handler: (responseText: string, responseUrl: string) => void) {
  const RealXHR = RawRequest.originalXHR;
  
  return function XMLHttpRequestProxy(...args: any[]) {
    const xhr = new RealXHR(...args);
    
    // 保存原始的 onreadystatechange
    const originalOnReadyStateChange = xhr.onreadystatechange;
    
    // 重写 onreadystatechange 来拦截响应
    xhr.onreadystatechange = function(...eventArgs: any[]) {
      // 当请求完成时，调用处理器
      if (xhr.readyState === 4 && (xhr.responseType === 'json' || xhr.responseType === 'text' || xhr.responseType === '')) {
        try {
          handler(xhr.responseText, xhr.responseURL);
        } catch (error) {
          console.error('Response handler error:', error);
        }
      }
      
      // 调用原始的处理器（如果存在）
      if (originalOnReadyStateChange) {
        originalOnReadyStateChange.apply(this, eventArgs);
      }
    };
    
    return xhr;
  } as any;
}

// function myFetch(...args) {
//   return RawRequest.originalFetch.apply(null, args).then((response) => {
//     handleResponse(response.text, response.url)
//     console.log({"fetchResponse": response});
//     return response;
//   });
// }

export class RequestInterceptor {
  private previousXHR: typeof XMLHttpRequest | null = null;

  enable(responseHandler: (responseText: string, responseUrl: string) => void) {
    // 保存当前的XMLHttpRequest（可能已经被其他扩展修改过）
    this.previousXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = customXHR(responseHandler);
    // window.fetch = myFetch;
  }

  disable() {
    // 恢复到启用前的状态，而不是初始状态
    if (this.previousXHR) {
      window.XMLHttpRequest = this.previousXHR;
      this.previousXHR = null;
    } else {
      window.XMLHttpRequest = RawRequest.originalXHR;
    }
    // window.fetch = RawRequest.originalFetch;
  }
}

