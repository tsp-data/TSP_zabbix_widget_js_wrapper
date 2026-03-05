import { createApp, reactive } from 'vue';
import App from './App.vue';

// Name under which Zabbix accesses this widget API on `window`.
const COMPONENT_NAME = 'example';

const api = {
  mount(el, { conf, context, zbx }) {
    // Shared reactive state injected into App.vue.
    const widgetState = reactive({
      conf: conf ?? {},
      context: context ?? {},
      zbx: zbx ?? {},
    });

    // Create and mount Vue app instance into widget container.
    const app = createApp(App);
    app.provide('widgetState', widgetState);
    app.mount(el);

    return {
      // Called by host when widget is removed.
      destroy() {
        app.unmount();
      },

      // Called by host to notify Vue component of requested update.
      update(payload = {}) {
        widgetState.conf = payload.conf ?? {};
        widgetState.context = payload.context ?? {};
        widgetState.zbx = payload.zbx ?? {};
      },
    };
  },
};

window[COMPONENT_NAME] = api;
