import { defineConfig } from 'vite';

// Tauri expects a fixed dev port and no clearing of the screen
export default defineConfig({
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    target: 'safari15',
  },
});
