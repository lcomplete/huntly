# Huntly Browser Extension

Browser extension for Huntly, built with WXT, React, and TypeScript.

## Prerequisites

- Node.js
- Yarn

## Install

```sh
yarn install
```

## Development

```sh
yarn dev
```

This starts the WXT development server and writes the extension build to `dist/`.

## Build

```sh
yarn build
```

## Package

```sh
yarn zip
```

## Test

```sh
yarn test
yarn typecheck
```

## Load the extension

1. Run `yarn build` or `yarn dev`.
2. Open the browser extension management page.
3. Enable developer mode.
4. Load the `dist/` directory as an unpacked extension.
