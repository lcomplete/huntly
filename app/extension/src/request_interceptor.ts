const RawRequest = {
  originalXHR: window.XMLHttpRequest,
  originalFetch: window.fetch.bind(window),
}

function customXHR(handler: (responseText: string, responseUrl: string) => void) {
  return function() {
    const xhr = new RawRequest.originalXHR;
    for (let attr in xhr) {
      if (attr === 'onreadystatechange') {
        xhr.onreadystatechange = (...args) => {
          if (this.readyState === 4 && (this.responseType === 'json' || this.responseType === 'text' || this.responseType === '')) {
            handler(this.responseText, this.responseURL);
          }
          this.onreadystatechange && this.onreadystatechange.apply(this, args);
        }
        continue;
      } else if (attr === 'onload') {
        xhr.onload = (...args) => {
          this.onload && this.onload.apply(this, args);
        }
        continue;
      }

      if (typeof xhr[attr] === 'function') {
        this[attr] = xhr[attr].bind(xhr);
      } else {
        // responseText和response不是writeable的，但拦截时需要修改它，所以修改就存储在this[`_${attr}`]上
        if (attr === 'responseText' || attr === 'response') {
          Object.defineProperty(this, attr, {
            get: () => this[`_${attr}`] === undefined ? xhr[attr] : this[`_${attr}`],
            set: (val) => this[`_${attr}`] = val,
            enumerable: true
          });
        } else {
          Object.defineProperty(this, attr, {
            get: () => xhr[attr],
            set: (val) => xhr[attr] = val,
            enumerable: true
          });
        }
      }
    }
  }
}

// function myFetch(...args) {
//   return RawRequest.originalFetch.apply(null, args).then((response) => {
//     handleResponse(response.text, response.url)
//     console.log({"fetchResponse": response});
//     return response;
//   });
// }

export class RequestInterceptor {
  enable(responseHandler: (responseText: string, responseUrl: string) => void) {
    window.XMLHttpRequest = customXHR(responseHandler);
    // window.fetch = myFetch;
  }

  disable() {
    window.XMLHttpRequest = RawRequest.originalXHR;
    // window.fetch = RawRequest.originalFetch;
  }
}

