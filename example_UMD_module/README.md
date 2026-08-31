# Example UMD Module (for Zabbix JS Wrapper)

This directory contains a reference JavaScript UMD widget module that can be hosted by the `js_wrapper` Zabbix plugin.

Its role is to show the recommended structure of a reusable frontend widget module, while the Zabbix-specific integration remains in the wrapper.

## Goal

This example demonstrates how to build a widget module that:

- is written as a normal Vue/JavaScript frontend project,
- exports a small host API in UMD format,
- can run inside Zabbix through the generic wrapper without Zabbix-specific frontend code.

## Technology

- Vue 3
- Vite
- ECharts (demo visualization library)

## UMD Host API (Required by Wrapper)

The built module must register itself on `window[componentName]` and expose `mount()`.

Current example uses:

- `componentName = "example"`
- global export: `window.example`

API shape:

```js
window.example = {
  mount(el, payload) {
    // create app and mount to el
    return {
      destroy() {
        // cleanup
      },
      update(nextPayload) {
        // refresh with new data/config
      }
    };
  }
};
```

Payload received from wrapper:

- `payload.conf`: parsed JSON configuration (`conf_json` from widget settings)
- `payload.context`: runtime metadata (for example `widgetid`, `rf_rate`)
- `payload.zbx`: the host API - `capabilities`, and `api(method, params)` for
  session-authenticated Zabbix API calls when the wrapper offers it (see "Host API"
  in `../js_wrapper/README.md`; this example does not call it - `debug_UMD_module`
  demonstrates it with a live test button)

## Build Outputs

Library build is configured in `vite.lib.config.js`.

Running:

```sh
npm run build:lib
```

produces:

- `dist/example.umd.js`
- `dist/example.css`

## How to Use with `js_wrapper`

1. Build this module:

```sh
npm install
npm run build:lib
```

2. Copy library outputs into wrapper assets:

- `dist/example.umd.js` -> `../js_wrapper/assets/umd/example.umd.js`
- `dist/example.css` -> `../js_wrapper/assets/umd/example.css`

3. In Zabbix widget configuration:

- set `component` to `example`
- set `conf_json` to any JSON object needed by your component

## Development Notes

- `src/entry.js` is the UMD entrypoint used by the wrapper.
- `src/main.js` is for standalone local app mode (Vite dev page).
- `src/App.vue` demonstrates a simple ECharts visualization and reacts to config updates.

## Extending This Example

To create your own module:

1. Change `COMPONENT_NAME` in `src/entry.js`.
2. Keep the same API contract (`mount`, optional `destroy`, optional `update`).
3. Adjust `vite.lib.config.js` output names to match your component name.
4. Copy the new build artifacts into `js_wrapper/assets/umd/`.
