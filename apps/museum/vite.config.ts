import { defineConfig } from 'vite';

export default defineConfig({
  base: '/museum/',
  server: {
    port: 5174,
    strictPort: true,
  },
});
