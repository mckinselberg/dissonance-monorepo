import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/dont-turn-around': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        ws: true,
      },
      '/trail-viewer': {
        target: 'http://localhost:5175',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
