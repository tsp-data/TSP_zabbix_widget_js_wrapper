# Changelog

All notable changes to the `js_wrapper` Zabbix module are listed here. The module directory of
every version is attached as a zip to the matching
[GitHub release](https://github.com/tsp-data/TSP_zabbix_widget_js_wrapper/releases). The version
is the `version` field of `js_wrapper/manifest.json`.

## [1.1] - 2026-10-06

First published release. Assets: `js_wrapper-1.1.zip` (the complete module directory, with the
prebuilt `example` and `debug` modules) and `SHA256SUMS.txt`.

### Added

- Host API `payload.zbx` for modules: `capabilities` and `api(method, params[, {signal}])`, a
  session-authenticated Zabbix API call through the new module action `widget.js_wrapper.api`.
  The call runs as the logged-in user and needs no token in the widget configuration; it is
  protected by CSRF, filtered by a deployment-editable allowlist (`includes/api_allowlist.php`)
  and re-applies the role API access rules (`includes/SessionApiClient.php`).
- Cache busting of the UMD assets: `<component>.umd.js` and `.css` are requested with a
  `?v=<mtime>` token taken from the file on the frontend, so a deployed build replaces a cached
  one without any web server configuration.
- `component` is re-validated against `^[A-Za-z0-9_-]+$` on the PHP side.
- `debug_UMD_module`: source of the diagnostics widget (payload view, `zbx.api` test button,
  update-cycle counter), prebuilt as `assets/umd/debug.umd.js`.
- MIT license; the third-party licenses of the bundled libraries are listed in the README.

### Changed

- The `process` shim (`process-shim.js`, which defined `window.process` on every dashboard page)
  was removed. UMD builds must inline `process.env.NODE_ENV` at build time (top-level `define` in
  the Vite config); `example_UMD_module` and `debug_UMD_module` are built that way.
- `context.rf_rate` is documented as informational only; the refresh cycle is driven by Zabbix.
- Line endings normalised to LF (`.gitattributes`).

## [1.0] - 2026-03-05

Initial version: the `JS wrapper` widget hosting a UMD module from `assets/umd/<component>.umd.js`
with the `mount`, `update` and `destroy` lifecycle, `conf_json` passed as `payload.conf`, and the
`example_UMD_module` reference module (Vue 3 and ECharts). Not published as a release.

[1.1]: https://github.com/tsp-data/TSP_zabbix_widget_js_wrapper/releases/tag/v1.1
[1.0]: https://github.com/tsp-data/TSP_zabbix_widget_js_wrapper/commit/b93dcab
