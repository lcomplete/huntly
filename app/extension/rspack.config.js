const path = require("path");
const { rspack } = require("@rspack/core");

const rootDir = __dirname;
const srcDir = path.join(rootDir, "src");
const publicDir = path.join(rootDir, "public");

const isFirefoxBuild = process.env.BROWSER === "firefox";
const outputDir = path.resolve(rootDir, isFirefoxBuild ? "dist_firefox" : "dist");
const manifestSource = path.join(
  publicDir,
  isFirefoxBuild ? "manifest-firefox.json" : "manifest.json",
);
const extensionVersion = process.env.EXTENSION_VERSION;
const popupOptionEntries = new Set(["popup", "options"]);

module.exports = (_, argv = {}) => {
  const mode = argv.mode || process.env.NODE_ENV || "production";
  const isDevelopment = mode === "development";

  return {
    mode,
    context: rootDir,
    entry: {
      popup: path.join(srcDir, "popup.tsx"),
      options: path.join(srcDir, "options.tsx"),
      background: path.join(srcDir, "background.ts"),
      content_script: path.join(srcDir, "content_script.tsx"),
      tweet_interceptor: path.join(srcDir, "tweet_interceptor.ts"),
      web_clipper: path.join(srcDir, "web_clipper.tsx"),
    },
    output: {
      path: path.join(outputDir, "js"),
      filename: "[name].js",
      chunkFilename: "[name].js",
      clean: true,
    },
    devtool: isDevelopment ? "cheap-source-map" : false,
    optimization: {
      splitChunks: {
        cacheGroups: {
          popupOptionsVendor: {
            name: "vendor",
            test: /[\\/]node_modules[\\/]/,
            chunks(chunk) {
              return popupOptionEntries.has(chunk.name);
            },
            minChunks: 1,
            enforce: true,
          },
          webClipperVendor: {
            name: "web_clipper_vendor",
            test: /[\\/]node_modules[\\/]/,
            chunks(chunk) {
              return chunk.name === "web_clipper";
            },
            minChunks: 1,
            enforce: true,
          },
        },
      },
    },
    module: {
      rules: [
        {
          resourceQuery: /raw/,
          type: "asset/source",
        },
        {
          test: /\.module\.css$/i,
          resourceQuery: { not: [/raw/] },
          use: [
            { loader: "style-loader" },
            {
              loader: "css-loader",
              options: {
                modules: {
                  localIdentName: "huntly-ext-[local]-[hash:base64:5]",
                },
              },
            },
            { loader: "postcss-loader" },
          ],
        },
        {
          test: /\.css$/i,
          exclude: /\.module\.css$/i,
          resourceQuery: { not: [/raw/] },
          use: [
            { loader: "style-loader" },
            { loader: "css-loader" },
            { loader: "postcss-loader" },
          ],
        },
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          type: "javascript/auto",
          use: {
            loader: "builtin:swc-loader",
            options: {
              sourceMaps: isDevelopment,
              jsc: {
                parser: {
                  syntax: "typescript",
                  tsx: true,
                },
                target: "es2015",
                transform: {
                  react: {
                    runtime: "classic",
                    development: isDevelopment,
                    refresh: false,
                  },
                },
              },
            },
          },
        },
      ],
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".css"],
    },
    watchOptions: isDevelopment
      ? {
          ignored: /node_modules/,
          aggregateTimeout: 80,
          followSymlinks: false,
        }
      : undefined,
    plugins: [
      new rspack.CopyRspackPlugin({
        patterns: [
          {
            context: publicDir,
            from: "**/*",
            to: outputDir,
            noErrorOnMissing: true,
            globOptions: {
              ignore: ["**/manifest*.json"],
            },
          },
          {
            from: manifestSource,
            to: path.resolve(outputDir, "manifest.json"),
            transform(content) {
              const manifest = JSON.parse(content.toString());
              if (extensionVersion) {
                manifest.version = extensionVersion;
              }
              return JSON.stringify(manifest, null, 2);
            },
          },
        ],
      }),
    ],
  };
};
