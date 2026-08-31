// class.widget.js
// Zabbix dashboard widget wrapper for Vue UMD components exposed as window[component].
//
// For component = "MyChart", wrapper loads:
//   modules/js_wrapper/assets/umd/MyChart.umd.js?v=<mtime>
//   modules/js_wrapper/assets/umd/MyChart.css?v=<mtime>
//
// The ?v= token comes from the server (WidgetView.php) and is the asset's modification
// time. Without it the URL never changes between releases, so a browser that cached one
// build serves it indefinitely - and because the script is injected after the page has
// loaded, a hard reload does not replace it either. See _assetQuery().
//
// Expected UMD API:
//   window.MyChart = {
//     mount(el, { conf, context, zbx }) => { destroy?(), update?() }
//   }
//
// payload.zbx is the host API the wrapper offers to the module:
//   zbx.capabilities        - what this wrapper build provides, e.g. { api: 1 }.
//                             Feature-detect on this (or on typeof zbx.api), never on
//                             a version number.
//   zbx.api(method, params[, {signal}])
//                           - session-authenticated Zabbix API call, executed with the
//                             permissions of the logged-in user through the module
//                             action "widget.js_wrapper.api". Resolves with the JSON-RPC
//                             result; rejects with an Error carrying code/data in the
//                             same shape api_jsonrpc.php produces. See "Host API" in
//                             README.md. Modules may instead keep calling
//                             api_jsonrpc.php with a configured token - both access
//                             modes are supported, they serve different trust models.

window.WidgetVueWrapper = class WidgetVueWrapper extends CWidget {
  static DEBUG = false;
  static COMPONENT_PATTERN = /^[A-Za-z0-9_-]+$/;
  // Shared caches across widget instances in one page session.
  static _loadedScripts = new Map(); // url -> Promise<void>
  static _loadedCss = new Set(); // url

  onInitialize() {
    if (typeof super.onInitialize === 'function') {
      super.onInitialize();
    }

    this._root = null;
    this._vueInstance = null;
    this._mountedComponent = null;
    this._mountedRoot = null;
    // Cache busting tokens per asset kind, supplied by the view response.
    this._assetVersions = {};
    // CSRF token for the API gate, supplied by the view response. Empty when the PHP
    // side predates the gate; zbx.capabilities.api is then simply not offered.
    this._apiCsrfToken = '';
    // Incremented on each sync; prevents stale async work from applying.
    this._renderToken = 0;
    this._isDestroyed = false;
  }

  _log(...args) {
    if (window.WidgetVueWrapper.DEBUG) {
      console.log('[VueWrapper]', ...args);
    }
  }

  _err(...args) {
    console.error('[VueWrapper]', ...args);
  }

  _getBodyEl() {
    if (this._body) return this._body;
    if (this._target) return this._target;
    if (this._container) return this._container;

    if (this._widgetid) {
      const widget = document.getElementById(`widget-${this._widgetid}`);
      if (widget) {
        return widget.querySelector('.dashboard-widget-body') || widget;
      }
    }

    return null;
  }

  _ensureRoot() {
    const body = this._getBodyEl();
    if (!body) return null;

    if (!this._root || !body.contains(this._root)) {
      // Reuse root from PHP view when available to avoid unnecessary DOM churn.
      this._root = body.querySelector('.vue-wrapper-root');

      if (!this._root) {
        this._root = document.createElement('div');
        this._root.className = 'vue-wrapper-root';
        body.appendChild(this._root);
      }
    }

    this._root.style.width = '100%';
    this._root.style.height = '100%';
    return this._root;
  }

  _getFieldsSafe() {
    return this._fields && typeof this._fields === 'object' ? this._fields : {};
  }

  _parseConf(conf_json) {
    try {
      if (typeof conf_json !== 'string') return {};
      const s = conf_json.trim();
      if (s === '') return {};
      return JSON.parse(s);
    }
    catch (e) {
      // Keep widget usable even with invalid JSON; component receives error details.
      return { _parseError: String(e), _raw: conf_json };
    }
  }

  /**
   * The widget's refresh interval field, passed to the module as informational context.
   *
   * It does NOT drive anything. Zabbix owns the refresh cycle and reaches the module
   * through processUpdateResponse() -> _sync(); a module must not schedule its own
   * refresh, and one that does not implement update() is remounted every cycle anyway.
   *
   * This is the raw field value, so it is `-1` whenever the interval is left at
   * "Default" - which is the usual case. The resolved number of seconds lives in
   * CWidget.getRfRate() and is deliberately not forwarded, because nothing consumes it.
   * See "context.rf_rate" in README.md.
   */
  _resolveRfRate(fields) {
    const v = fields?.rf_rate;
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  _getAssetBase() {
    return 'modules/js_wrapper/assets';
  }

  /**
   * Cache busting suffix for one asset kind ("js" or "css").
   *
   * Returns an empty string when the server sent no token - a frontend running an older
   * js_wrapper, or a component whose file is missing. The wrapper then behaves exactly
   * as it did before, requesting the bare URL.
   */
  _assetQuery(kind) {
    const version = this._assetVersions ? this._assetVersions[kind] : null;
    return version ? `?v=${encodeURIComponent(version)}` : '';
  }

  /**
   * One call through the API gate ("widget.js_wrapper.api").
   *
   * Runs with the permissions of the logged-in user - the gate authenticates the
   * frontend session and the API layer applies the user's own rights, so there is no
   * token anywhere in the widget configuration.
   *
   * Errors are normalized to an Error whose message is ready to display and which
   * carries `code`/`data` (and `httpStatus` for transport failures) in the same shape
   * a module gets from api_jsonrpc.php, so both access modes can share error handling.
   *
   * @param {string} method               e.g. "maintenance.get"
   * @param {object|Array} params         JSON-RPC params
   * @param {{signal?: AbortSignal}} opts Optional; lets the module keep timeout/abort
   *                                      semantics it would have with its own fetch.
   * @returns {Promise<any>}              The JSON-RPC result.
   */
  async _hostApiCall(method, params, opts) {
    const res = await fetch('zabbix.php?action=widget.js_wrapper.api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      signal: opts?.signal,
      // Module actions have their CSRF token checked against the action name; the
      // token itself arrives with every widget update response (see WidgetView.php).
      body: JSON.stringify({ method, params: params ?? {}, _csrf_token: this._apiCsrfToken })
    });

    if (!res.ok) {
      const err = new Error(`Host API transport error: HTTP ${res.status}`);
      err.httpStatus = res.status;
      throw err;
    }

    const payload = await res.json();

    if (payload && payload.error) {
      // Two shapes can arrive: the gate's JSON-RPC style {code, message, data}, and
      // the Zabbix layout error {title, messages} (e.g. a CSRF or access failure that
      // terminates the request before the gate runs).
      const e = payload.error;
      const err = new Error(
        e.code !== undefined
          ? `Zabbix API error ${e.code}: ${e.message}${e.data ? ` ${e.data}` : ''}`
          : `${e.title ?? 'Host API error'}${e.messages?.length ? `: ${e.messages.join(' ')}` : ''}`
      );
      err.code = e.code;
      err.data = e.data;
      throw err;
    }

    if (!payload || !('result' in payload)) {
      throw new Error('Host API response missing "result"');
    }

    return payload.result;
  }

  /**
   * The host API object handed to the module as payload.zbx.
   *
   * `capabilities` names what this wrapper offers, so a module feature-detects
   * instead of guessing from wrapper versions. `api` is only offered once the PHP
   * side has supplied the CSRF token - which it does with the same response that
   * triggers the first _sync(), so a module never sees the capability flap.
   */
  _buildZbx() {
    const zbx = { capabilities: {} };

    if (this._apiCsrfToken) {
      zbx.capabilities.api = 1;
      zbx.api = (method, params, opts) => this._hostApiCall(method, params, opts);
    }

    return zbx;
  }

  _destroyVue() {
    // Unified cleanup path for normal destroy and error states.
    try {
      if (this._vueInstance && typeof this._vueInstance.destroy === 'function') {
        this._vueInstance.destroy();
      }
    }
    catch (e) {
      this._err('Error destroying Vue instance:', e);
    }

    this._vueInstance = null;
    this._mountedComponent = null;
    this._mountedRoot = null;
  }

  _loadScriptOnce(url) {
    const cache = window.WidgetVueWrapper._loadedScripts;
    if (cache.has(url)) {
      return cache.get(url);
    }

    // Deduplicate concurrent loads and later reuses of the same UMD script.
    const promise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(s);
    }).catch((err) => {
      // Allow retry on next update after a failed load.
      cache.delete(url);
      throw err;
    });

    cache.set(url, promise);
    return promise;
  }

  _loadCssOnce(url) {
    const cache = window.WidgetVueWrapper._loadedCss;
    if (cache.has(url)) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = () => this._log('CSS loaded:', url);
    link.onerror = () => this._err('Failed to load CSS:', url);
    document.head.appendChild(link);
    cache.add(url);
  }

  async _ensureApi(component, token) {
    const base = this._getAssetBase();
    const jsUrl = `${base}/umd/${component}.umd.js${this._assetQuery('js')}`;
    const cssUrl = `${base}/umd/${component}.css${this._assetQuery('css')}`;

    this._loadCssOnce(cssUrl);

    // UMD plugin is expected to export itself as window[component].
    let api = window[component];
    if (!api || typeof api.mount !== 'function') {
      await this._loadScriptOnce(jsUrl);

      if (token !== this._renderToken || this._isDestroyed) {
        return null;
      }

      api = window[component];
    }

    if (!api || typeof api.mount !== 'function') {
      throw new Error(`Vue component "${component}" not found or missing mount().`);
    }

    return api;
  }

  _renderError(root, message, details) {
    // Ensure previous instance is not left running after a failure.
    this._destroyVue();
    this._err(message, details || '');
    root.textContent = message;
  }

  _mount(root, api, payload) {
    // Always reset previous instance before mounting a new one.
    this._destroyVue();
    root.innerHTML = '';
    this._vueInstance = api.mount(root, payload);
    this._mountedComponent = payload.component;
    this._mountedRoot = root;
  }

  _updateOrRemount(root, api, payload) {
    const mountRootChanged = this._mountedRoot !== root;
    if (!this._vueInstance || this._mountedComponent !== payload.component || mountRootChanged) {
      this._mount(root, api, payload);
      return;
    }

    // If component exposes update(), call it on every refresh cycle.
    // This supports time-driven behavior even when payload is unchanged.
    if (typeof this._vueInstance.update === 'function') {
      this._vueInstance.update(payload);
      return;
    }

    // No update() support: remount on every refresh cycle.
    this._mount(root, api, payload);
  }

  async _sync(from) {
    // Token guards this async flow against races with later refreshes/destroy.
    const token = ++this._renderToken;
    const root = this._ensureRoot();
    if (!root) {
      this._err(`${from}: widget body not available`);
      return;
    }

    const fields = this._getFieldsSafe();
    const componentPattern = '^[A-Za-z0-9_-]+$';
    const component =
      typeof fields.component === 'string' ? fields.component.trim() : fields.component;

    if (!component || typeof component !== 'string') {
      this._renderError(root, 'Widget configuration error: missing "component" field.', { fields });
      return;
    }

    if (!window.WidgetVueWrapper.COMPONENT_PATTERN.test(component)) {
      this._renderError(
        root,
        `Widget configuration error: invalid "component". Required pattern: ${componentPattern}`,
        { component }
      );
      return;
    }

    const conf = this._parseConf(fields.conf_json ?? '{}');
    const context = {
      widgetid: this._widgetid ?? null,
      rf_rate: this._resolveRfRate(fields)
    };
    const payload = { component, conf, context, zbx: this._buildZbx() };
    let api;
    try {
      api = await this._ensureApi(component, token);
      if (!api || token !== this._renderToken || this._isDestroyed) {
        return;
      }
    }
    catch (e) {
      this._renderError(root, `Failed to load component "${component}".`, e);
      return;
    }

    try {
      this._updateOrRemount(root, api, payload);
      this._log(`${from}: synced`, { component });
    }
    catch (e) {
      this._renderError(root, `Vue mount/update error: ${String(e)}`, e);
    }
  }

  processUpdateResponse(response) {
    // Do not call super here: base implementation can replace widget DOM,
    // which would force remount on every refresh cycle.
    // This widget keeps its own mount/update cycle for UMD component stability.

    // Picked up before _sync(), which is what builds the asset URLs. This is also the
    // only path into _sync(), so the tokens are always in place before the first load.
    if (response && typeof response.asset_versions === 'object' && response.asset_versions) {
      this._assetVersions = response.asset_versions;
    }

    // Same guarantee for the API gate token: present before the first mount, so
    // zbx.capabilities.api never appears mid-session. Absent from responses of a PHP
    // side that predates the gate, in which case the capability is not offered.
    if (response && typeof response.api_csrf_token === 'string') {
      this._apiCsrfToken = response.api_csrf_token;
    }

    this._sync('processUpdateResponse');
  }

  onDestroy() {
    this._isDestroyed = true;
    this._renderToken++;
    this._destroyVue();
    this._root = null;

    if (typeof super.onDestroy === 'function') {
      super.onDestroy();
    }
  }
};
