import { createApp } from 'vue';
import App from './App.vue';

createApp(App, {
  context: { //provided by Zabbix, contains info about widget id and refresh rate
    // Not used in this example, but you can access widget context here.
  },
  conf: {
    // Not used in this example, but you can pass any configuration here.
  },
}).mount('#app');
