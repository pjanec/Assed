/// <reference types="vitest" />

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 8080,
  },
  define: {
    'process.env': {}
  },
  // Vitest configuration integrated into vite.config.ts
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
    deps: {
      inline: ['vuetify'],
    },
    tsconfig: 'tsconfig.vitest.json' 
  },
});
















