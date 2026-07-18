import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig(({ command }) => ({
  // Served at /trail-viewer/ on the shared Render static site (see render.yaml).
  // Dev uses the same base so the home app can proxy this route locally.
  base: '/trail-viewer/',
  // Scoped to this app only — the atmosphere-row control panel pilot is the
  // first (and so far only) use of Preact in this monorepo.
  plugins: [preact()],
  resolve: {
    alias: {
      '@dissonance/audio':  path.resolve(__dirname, '../../packages/audio/src'),
      '@dissonance/engine': path.resolve(__dirname, '../../packages/engine/src'),
      '@dissonance/world':  path.resolve(__dirname, '../../packages/world/src'),
      '@dissonance/geo':    path.resolve(__dirname, '../../packages/geo/src'),
      '@dissonance/player': path.resolve(__dirname, '../../packages/player/src'),
      '@dissonance/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@dissonance/utils': path.resolve(__dirname, '../../packages/utils/src'),
    },
    // pnpm creates separate symlinks per workspace package; force single instance
    dedupe: ['@babylonjs/core'],
  },
  server: {
    port: 5175,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, '../../')],
    },
  },
  optimizeDeps: {
    // @babylonjs/core and @babylonjs/materials (WaterMaterial) are both native
    // ESM ("type":"module") — excluding prevents the re-optimization loop
    // caused by Vite discovering them via multiple pnpm symlink paths
    exclude: ['@babylonjs/core', '@babylonjs/materials'],
  },
}));
