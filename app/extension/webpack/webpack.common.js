const webpack = require("webpack");
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const srcDir = path.join(__dirname, "..", "src");

let outputPath = 'dist';
let manifestFile = 'public/manifest.json'

if (process.env.BROWSER === 'firefox') {
  outputPath = 'dist_firefox';
  manifestFile = 'public/manifest-firefox.json';
}

// Get version from environment variable (without 'v' prefix)
const extensionVersion = process.env.EXTENSION_VERSION;

module.exports = {
  entry: {
    popup: path.join(srcDir, 'popup.tsx'),
    options: path.join(srcDir, 'options.tsx'),
    background: path.join(srcDir, 'background.ts'),
    content_script: path.join(srcDir, 'content_script.tsx'),
    tweet_interceptor: path.join(srcDir, 'tweet_interceptor.ts'),
    web_clipper: path.join(srcDir, 'web_clipper.tsx'),
  },
  output: {
    path: path.resolve(__dirname, '..', outputPath , 'js'),
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
      // CSS as raw string for Shadow DOM injection (use ?raw query)
      {
        resourceQuery: /raw/,
        type: 'asset/source',
      },
      {
        test: /\.module\.css$/i,
        resourceQuery: { not: [/raw/] },
        use: [
          {loader: "style-loader"},
          {
            loader: "css-loader",
            options: {
              modules: {
                localIdentName: 'huntly-ext-[local]-[hash:base64:5]'
              }
            }
          },
          {loader: "postcss-loader"}
        ]
      },
      {
        test: /\.css$/i,
        exclude: /\.module\.css$/i,
        resourceQuery: { not: [/raw/] },
        use: [
          {loader: "style-loader"},
          {
            loader: "css-loader",
          },
          {loader: "postcss-loader"}
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
      patterns: [{
        from: ".", to: '../', context: "public",
        globOptions: { ignore: ['**/manifest*.json'] }
      }],
      options: {},
    }),
    new CopyPlugin({
      patterns: [{
        from: manifestFile,
        to: path.resolve(__dirname, '..', outputPath, 'manifest.json'),
        // Only apply transform when EXTENSION_VERSION is set (during release builds)
        // This avoids unnecessary re-compilation during development
        ...(extensionVersion ? {
          transform(content) {
            const manifest = JSON.parse(content.toString());
            manifest.version = extensionVersion;
            return JSON.stringify(manifest, null, 2);
          }
        } : {})
      }]
    })
  ],
};
