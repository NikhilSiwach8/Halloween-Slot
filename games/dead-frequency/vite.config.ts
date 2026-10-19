/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  base: './',
  // Older phones: compile scripts and styles down for iOS Safari 14 / Chrome 87 era browsers.
  build: { outDir: 'dist', emptyOutDir: true, target: ['es2019', 'safari14', 'chrome87', 'firefox78', 'edge88'], cssTarget: ['safari14', 'chrome87', 'firefox78', 'edge88'] },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
});
