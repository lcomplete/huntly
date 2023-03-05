const webpack = require("webpack");
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const srcDir = path.join(__dirname, "..", "src");

module.exports = {
  entry: {
    popup: path.join(srcDir, 'popup.tsx'),
    options: path.join(srcDir, 'options.tsx'),
    background: path.join(srcDir, 'background.ts'),
    content_script: path.join(srcDir, 'content_script.tsx'),
    request_interceptor: path.join(srcDir, 'request_interceptor.ts'),
    tweet_interceptor: path.join(srcDir, 'tweet_interceptor.ts'),
    web_clipper: path.join(srcDir, 'web_clipper.ts'),
  },
  output: {
    path: path.join(__dirname, "../dist/js"),
    filename: "[name].js",
  },
  optimization: {
    splitChunks: {
      name: "vendor",
      chunks(chunk) {
        return chunk.name !== 'background';
      }
    },
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          {loader: "style-loader"},
          {
            loader: "css-loader",
            options: { modules: true },
          }
        ]
      },
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".css"],
  },
  plugins: [
    new CopyPlugin({
      patterns: [{from: ".", to: "../", context: "public"}],
      options: {},
    }),
  ],
};
