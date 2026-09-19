import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:5173/' } },
    include: ['src/**/*.test.tsx'],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
