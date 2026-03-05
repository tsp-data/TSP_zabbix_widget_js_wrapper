# BUILD and Development (`example_UMD_module`)

This document explains how to build the example UMD module, run it in local development mode, and deploy artifacts for use with the Zabbix `js_wrapper` module.

## Project Origin

The base project skeleton was created following the official Vue Quick Start approach:

- https://vuejs.org/guide/quick-start

## 1. Prerequisites

- Node.js version compatible with `package.json` engines (`^20.19.0 || >=22.12.0`)
- npm

## 2. Install Dependencies

```sh
cd example_UMD_module
npm install
```

## 3. Local Development (outside Zabbix)

During development you can run the widget as a standalone Vue app, without Zabbix:

```sh
npm run dev
```

Benefits:

- fast frontend iteration with Vite hot reload,
- ability to inspect component state and tree via Vue DevTools.

In this mode, the app is served by Vite and rendered through `src/main.js`.

## 4. Build UMD Library for Zabbix Wrapper

To build deployable UMD artifacts used by `js_wrapper`:

```sh
npm run build:lib
```

Build configuration is in `vite.lib.config.js`.

Expected outputs:

- `dist/example.umd.js`
- `dist/example.css`

## 5. Deploy Artifacts to `js_wrapper`

Copy built files into Zabbix wrapper assets:

```sh
cp dist/example.umd.js ../js_wrapper/assets/umd/example.umd.js
cp dist/example.css ../js_wrapper/assets/umd/example.css
```

Then in Zabbix widget configuration set:

- `component`: `example`
- `conf_json`: valid JSON (for example `{}`)

## 6. Optional Commands

Lint and formatting helpers:

```sh
npm run lint
npm run format
```

## 7. Troubleshooting

- If widget does not load in Zabbix, verify both files exist in `js_wrapper/assets/umd/`.
- If global API is not found, check that `src/entry.js` exports `window.example`.
- If UI renders in local dev but not in Zabbix, re-check wrapper `component` value and file names.
