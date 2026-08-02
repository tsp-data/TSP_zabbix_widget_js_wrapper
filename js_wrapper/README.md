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

### Cache Busting

Both URLs carry a `?v=<mtime>` token, where `<mtime>` is the modification time of that
file on the frontend. `WidgetView.php` reads it and passes it to the client as
`asset_versions` on the widget view response.

This is not cosmetic. Without it the URL is identical for every release of a component,
so a browser that cached one build keeps serving it. It is also not something a user can
work around: the wrapper injects the `<script>` element itself, *after* the page has
loaded, and a hard reload only bypasses the cache for resources fetched as part of the
navigation. A stale build therefore survives Ctrl+F5 and can be cleared only through
devtools or by wiping the browser cache.

The token changes exactly when the file changes, so deploying a new build is enough -
there is no version to bump and nothing to remember.

**No web server configuration is required.** This works from installing the module alone,
which is deliberate: a fix that depends on an `apache`/`nginx` change is a fix that will be
missing at some deployment. The correctness of the mechanism comes from the URL itself, not
from response headers.

Without cache headers a browser applies heuristic freshness, so the *same* build may cost
an occasional conditional request (a `304`, a few hundred bytes) instead of coming straight
from cache. That is the accepted trade for needing no configuration. A deployment that
wants to avoid even that can add a long lifetime, which is safe precisely because the URL
now identifies one exact build - but it is an optimisation, not a requirement:

```apache
<Directory /usr/share/zabbix/modules/js_wrapper/assets/umd>
    Header set Cache-Control "public, max-age=31536000, immutable"
</Directory>
```

Versioned URLs also survive intermediaries: a reverse proxy or CDN sees a different URL
per build, so no header negotiation has to be trusted there either.

Both halves degrade gracefully. A frontend running an older `js_wrapper` sends no
`asset_versions` and the wrapper requests the bare URL as it always did; a newer PHP side
paired with an older `class.widget.js` simply has its extra response key ignored. Neither
mismatch should be combined with the optional `immutable` header above.

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
