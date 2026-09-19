import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const proxy = { '/api': 'http://127.0.0.1:5001', '/media': 'http://127.0.0.1:5001' };
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 5173, strictPort: true, proxy },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          ui: ['@mui/material', '@emotion/react', '@emotion/styled'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
