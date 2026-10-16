/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
});
