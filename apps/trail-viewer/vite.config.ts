import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@dissonance/engine': path.resolve(__dirname, '../../packages/engine/src'),
      '@dissonance/world':  path.resolve(__dirname, '../../packages/world/src'),
      '@dissonance/geo':    path.resolve(__dirname, '../../packages/geo/src'),
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
});
