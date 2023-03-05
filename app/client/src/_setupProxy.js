import { API_BASE } from "./env";
const {createProxyMiddleware} = require("http-proxy-middleware");

module.exports = function (app){
	app.use(
    '/api',
    createProxyMiddleware({
      target: `${API_BASE}`,
      changeOrigin: true,
    })
  );
}