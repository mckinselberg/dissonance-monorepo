import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/museum/dont-turn-around': {
        target: 'http://localhost:5176',
        changeOrigin: true,
        ws: true,
      },
      '/museum': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        ws: true,
      },
      '/world': {
        target: 'http://localhost:5175',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
