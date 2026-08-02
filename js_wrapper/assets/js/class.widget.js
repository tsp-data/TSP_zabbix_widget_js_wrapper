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
    // zbx is reserved for future host API surface shared with UMD plugins.
    const payload = { component, conf, context, zbx: {} };
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
