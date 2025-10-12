import { createApp } from 'vue';
import App from './App.vue';
import { createPinia } from 'pinia';
import router from '@/content/router/index';
import { initializeSchemas } from '@/content/schemas/packageSchema';

// --- Core Imports ---
import { CorePlugin } from '@/core/plugin';
import { vDragsource } from '@/core/directives/dragsource';

// --- Content Imports ---
import { ContentPlugin } from '@/content/plugin';

// --- Vuetify Imports ---
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import '@mdi/font/css/materialdesignicons.css';

initializeSchemas();

const app = createApp(App);

app.use(createPinia());

// Install Plugins in order
app.use(CorePlugin);    // Installs core services (context menu registry)
app.use(ContentPlugin); // Installs all content logic (asset registry, rules, etc.)

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
  },
  theme: {
    defaultTheme: 'light'
  }
});
app.use(vuetify);

app.use(router);

app.directive('dragsource', vDragsource);

app.mount('#app');

// Context menu handlers will be registered by the App component
// This ensures they are registered within the proper Vue context

console.log('Application starting...');







