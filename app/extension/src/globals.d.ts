export {}

declare global {
  const __HUNTLY_DEV__: boolean;

  interface Window {
    XMLHttpRequest: any;
    // fetch:fetch;
  }
}
