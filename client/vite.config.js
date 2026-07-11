import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'inject-sw-version',
      closeBundle() {
        const swPath = resolve(__dirname, 'dist', 'sw.js');
        try {
          const sw = readFileSync(swPath, 'utf-8');
          const version = Date.now().toString(36);
          writeFileSync(swPath, sw.replace(/__SW_BUILD__/g, version));
        } catch { /* sw.js no existe durante dev */ }
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:4000',
      '/tournaments': 'http://localhost:4000',
      '/players': 'http://localhost:4000',
      '/rounds': 'http://localhost:4000',
      '/fide': 'http://localhost:4000',
      '/stats': 'http://localhost:4000',
      '/public': 'http://localhost:4000',
      '/sse': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
});
