import { defineConfig } from 'vite';

// Tauri expects a fixed dev port and no clearing of the screen
export default defineConfig({
  clearScreen: false,
  // hydra-synth (and some deps) reference Node's `global`
  define: { global: 'globalThis' },
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    target: 'safari15',
  },
});
