# JS Wrapper (Zabbix Widget Host for UMD Modules)

This module is a Zabbix dashboard widget that hosts a JavaScript UMD component.

It lets you keep the Zabbix integration in PHP/host JS (`js_wrapper`) and your frontend widget logic in a standalone UMD module.

## What This Wrapper Does

- Registers a custom Zabbix widget (`JS wrapper`)
- Reads widget configuration fields:
  - `component` (required): logical component name
  - `conf_json` (optional): JSON string passed to the UMD module
- Resolves and loads runtime assets based on `component`
- Calls the UMD module lifecycle (`mount`, then `update` or remount on refresh)
- Handles teardown (`destroy`) when widget is removed

## Runtime Asset Resolution

For `component = MyChart`, wrapper expects:

- `modules/js_wrapper/assets/umd/MyChart.umd.js`
- `modules/js_wrapper/assets/umd/MyChart.css`

Notes:

- Script is required.
- CSS is attempted automatically; load failure is logged but does not block script mount.
- Script/CSS loads are cached across widget instances in the same page session.

## Expected UMD API Contract

Your UMD file must expose a global object on `window[component]` with `mount()`.

```js
window.MyChart = {
  mount(el, payload) {
    // create app / render into el
    return {
      destroy() {
        // optional cleanup
      },
      update(nextPayload) {
        // optional incremental update
      }
    };
  }
};
```

### `mount(el, payload)`

- `el`: DOM element owned by the wrapper (`.vue-wrapper-root`)
- `payload`:
  - `component`: selected component name
  - `conf`: parsed object from `conf_json`
  - `context`:
    - `widgetid`: Zabbix widget id (or `null`)
    - `rf_rate`: refresh rate if available, otherwise `null`
  - `zbx`: reserved object for host API extensions (currently empty)

Return value:

- Any object (instance handle), optionally with:
  - `destroy()` called during unmount/error replacement
  - `update(payload)` called on refresh if present

## Lifecycle Behavior

- Initial render: wrapper ensures root element, validates config, loads API, calls `mount()`.
- Refresh cycle (`processUpdateResponse`):
  - if returned instance has `update()`, wrapper calls `update(payload)`
  - otherwise wrapper remounts by calling `destroy()` (if present) and `mount()` again
- Widget destroy: wrapper calls `destroy()` (if present) and releases local references.

## Configuration Rules and Error Handling

- `component` must match: `^[A-Za-z0-9_-]+$`
- Missing or invalid `component` shows a configuration error in widget body.
- If `conf_json` is invalid JSON, wrapper still runs and passes:
  - `{ _parseError: "...", _raw: "original text" }`
- Missing global API or missing `mount()` produces a runtime load error.

## Minimal Integration Checklist

1. Build your UMD module so it assigns `window[YourComponentName]`.
2. Implement at least `mount(el, payload)`.
3. (Recommended) implement `destroy()` and `update(payload)`.
4. Copy build outputs to:
   - `assets/umd/YourComponentName.umd.js`
   - `assets/umd/YourComponentName.css`
5. In widget config, set `component = YourComponentName`.
6. Put your JSON config into `conf_json`.

## Related Files

- `manifest.json`: widget registration and assets
- `includes/WidgetForm.php`: widget config fields
- `actions/WidgetView.php`: data passed to view
- `views/widget.view.php`: root mount container
- `assets/js/class.widget.js`: host runtime + lifecycle bridge
