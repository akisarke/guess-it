import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
    // A leading dot matches any subdomain, so the random host ngrok hands out on each
    // restart keeps working without another edit.
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.io'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
      },
    },
  },
});
