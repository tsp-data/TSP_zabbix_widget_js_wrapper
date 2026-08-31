# Debug UMD Module (for Zabbix JS Wrapper)

A diagnostics widget module for the `js_wrapper` Zabbix plugin: it renders everything the
wrapper hands to a module, instead of visualizing data.

Point a `JS wrapper` widget at component `debug` to see:

- `conf`: the parsed `conf_json`, exactly as a module receives it,
- `context`: the runtime metadata (`widgetid`, `rf_rate`),
- `zbx`: the host API object, with its `capabilities`,
- a **live test button for `zbx.api`** - one `apiinfo.version` call through the wrapper's
  session gate, with the raw result or error displayed. This is the quickest in-Zabbix
  smoke test of the gate: no devtools, no token, just a widget,
- an **update cycle counter**, which makes the wrapper-driven refresh visible.

That makes it the first thing to deploy when a module of your own misbehaves: it answers
"what does the wrapper actually send here?" and "does the host API work on this
dashboard?" with no moving parts of its own.

## Technology

- Vue 3 + TypeScript
- Vite

## UMD Host API (Required by Wrapper)

- `componentName = "debug"`
- global export: `window.debug`
- `mount(el, payload)` returns `{ destroy(), update(payload) }` - `update()` refreshes
  the displayed payload in place and increments the cycle counter.

## Build and Deploy

```sh
npm install
npm run build:lib
```

produces `dist/debug.umd.js` and `dist/debug.css` (configured in `vite.lib.config.ts`).
Copy both into the wrapper assets:

```sh
cp dist/debug.umd.js ../js_wrapper/assets/umd/debug.umd.js
cp dist/debug.css ../js_wrapper/assets/umd/debug.css
```

In the Zabbix widget configuration set `component` to `debug`; `conf_json` can hold any
JSON - displaying it is the point.

The build is self-contained: `vite.lib.config.ts` replaces `process.env.NODE_ENV` at
build time (a top-level `define` - nested under `build` it would be silently ignored),
so the artifact needs no shim from the wrapper. See "The build must be self-contained"
in `../js_wrapper/README.md`.

## Local Development

```sh
npm run dev
```

runs the widget as a standalone Vue app through `src/main.ts`, which provides a sample
payload including a mocked `zbx.api`, so the whole view - test button included - can be
exercised without Zabbix.

Lint and formatting:

```sh
npm run lint
npm run format
```

## Project Structure

- `src/entry.ts` - UMD entrypoint: registers `window.debug`, implements
  `mount`/`update`/`destroy` over a shared reactive state
- `src/App.vue` - the diagnostics view
- `src/main.ts` - standalone dev entry point with a sample payload
- `vite.lib.config.ts` - UMD library build configuration
