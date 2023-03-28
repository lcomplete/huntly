const webpack = require("webpack");
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const srcDir = path.join(__dirname, "..", "src/renderer");

module.exports = {
  entry: {
    app: path.join(srcDir, 'App.tsx'),
  },
  output: {
    path: path.join(__dirname, "../dist/renderer/"),
    filename: "[name].js",
  },
  optimization: {
    splitChunks: {
      name: "vendor",
    },
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          {loader: "style-loader"},
          {loader: "css-loader"}
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
