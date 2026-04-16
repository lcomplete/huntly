export const isDebugging =
  typeof __HUNTLY_DEV__ !== "undefined"
    ? __HUNTLY_DEV__
    : /dev/.test(process.env.NODE_ENV || "");
