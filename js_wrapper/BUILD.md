# BUILD and Deployment (Zabbix)

This document describes how to deploy the `js_wrapper` module into a Zabbix frontend and how to connect a UMD widget build.

## 1. Prerequisites

- Running Zabbix frontend with custom modules enabled.
- Access to the Zabbix frontend filesystem.
- Permission to copy files into the Zabbix frontend `modules` directory.
- Built UMD widget artifacts (`*.umd.js` and `*.css`).

## 2. Build the UMD Module (example)

If you use the reference module from `example_UMD_module`:

```sh
cd example_UMD_module
npm install
npm run build:lib
```

Expected output:

- `dist/example.umd.js`
- `dist/example.css`

## 3. Copy Files to Zabbix Frontend

Set your frontend modules directory (example path shown below, adjust to your installation):

```sh
ZABBIX_MODULES_DIR=/usr/share/zabbix/modules
```

Create target and copy wrapper files:

```sh
cp -r js_wrapper "$ZABBIX_MODULES_DIR"
```

Copy UMD build artifacts into wrapper assets:

```sh
cp example_UMD_module/dist/example.umd.js "$ZABBIX_MODULES_DIR/js_wrapper/assets/umd/example.umd.js"
cp example_UMD_module/dist/example.css "$ZABBIX_MODULES_DIR/js_wrapper/assets/umd/example.css"
```

## 5. Permissions

Ensure the web server (apache/nginx) user can read deployed files.


## 6. Enable Module in Zabbix UI

1. Open Zabbix frontend.
2. Go to `Administration -> General -> Modules`.
3. Click "Scan directory" button 
3. Find module `JS wrapper` and enable it.

If the module is not visible:

- verify path and directory name (`js_wrapper`),
- verify `manifest.json` exists in module root,
- verify frontend cache/reload.

## 7. Add Widget and Configure Component

1. Open any dashboard in edit mode.
2. Add widget `JS wrapper`.
3. Set:
   - `component`: `example`
   - `conf_json`: any valid JSON, for example `{}`
4. Save the widget.

The wrapper will load:

- `modules/js_wrapper/assets/umd/example.umd.js`
- `modules/js_wrapper/assets/umd/example.css`

and call `window.example.mount(...)`.

## 8. Update Workflow

When updating frontend module code:

- copy updated `js_wrapper` files again to `.../modules/js_wrapper/`.

When updating only UMD widget code:

- rebuild UMD library,
- replace files in `.../modules/js_wrapper/assets/umd/`.

## 9. Smoke Test Checklist

- Module appears in Zabbix module list and is enabled.
- `JS wrapper` widget is available in dashboard widget picker.
- Widget renders without runtime errors.
- Browser devtools show successful load of `*.umd.js` and `*.css`.
- Widget refresh cycle works (`update()` is called, or remount fallback works).
