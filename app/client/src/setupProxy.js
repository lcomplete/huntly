const { createProxyMiddleware } = require("http-proxy-middleware");

const target = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080/api";

module.exports = function registerProxy(app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );
};
