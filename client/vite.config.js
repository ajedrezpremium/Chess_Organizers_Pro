import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
