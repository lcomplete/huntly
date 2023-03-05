export {}

declare global {
  interface Window {
    XMLHttpRequest: any;
    // fetch:fetch;
  }
}