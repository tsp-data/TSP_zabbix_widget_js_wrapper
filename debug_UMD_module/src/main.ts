// Local development entry point (npm run dev) - runs the widget as a standalone
// Vue app with a sample payload, the way the wrapper would provide one.
import { createApp, reactive } from 'vue'
import App from './App.vue'

const app = createApp(App)

app.provide(
  'widgetState',
  reactive({
    conf: { sample: true, note: 'edit src/main.ts to change this dev payload' },
    context: { widgetid: '12345', rf_rate: 60 },
    zbx: {
      capabilities: { api: 1 },
      // Local stand-in for the wrapper's session gate, so the tester button works
      // in dev. In Zabbix the wrapper provides the real implementation.
      api: async (method: string) => `dev mock response for ${method}`,
    },
    updates: 0,
  }),
)

app.mount('#app')
