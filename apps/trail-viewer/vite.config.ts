import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig(({ command }) => ({
  // Served at /trail-viewer/ on the shared Render static site (see render.yaml).
  // Keep dev server at '/' so `pnpm dev` still works at localhost:5173/.
  base: command === 'build' ? '/trail-viewer/' : '/',
  resolve: {
    alias: {
      '@dissonance/engine': path.resolve(__dirname, '../../packages/engine/src'),
      '@dissonance/world':  path.resolve(__dirname, '../../packages/world/src'),
      '@dissonance/geo':    path.resolve(__dirname, '../../packages/geo/src'),
      '@dissonance/player': path.resolve(__dirname, '../../packages/player/src'),
    },
    // pnpm creates separate symlinks per workspace package; force single instance
    dedupe: ['@babylonjs/core'],
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '../../')],
    },
  },
  optimizeDeps: {
    // @babylonjs/core is native ESM ("type":"module") — excluding prevents the
    // re-optimization loop caused by Vite discovering it via multiple pnpm symlink paths
    exclude: ['@babylonjs/core'],
  },
}));
