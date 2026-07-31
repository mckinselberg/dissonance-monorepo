import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig(({ command }) => ({
  // Served at /world/ on the shared Render static site (see render.yaml).
  // Dev uses the same base so the home app can proxy this route locally.
  base: '/world/',
  // Scoped to this app only — the atmosphere-row control panel pilot is the
  // first (and so far only) use of Preact in this monorepo.
  plugins: [preact()],
  resolve: {
    alias: {
      '@dissonance/audio':  path.resolve(__dirname, '../../packages/audio/src'),
      '@dissonance/engine': path.resolve(__dirname, '../../packages/engine/src'),
      '@dissonance/world':  path.resolve(__dirname, '../../packages/world/src'),
      '@dissonance/geo':    path.resolve(__dirname, '../../packages/geo/src'),
      '@dissonance/materials': path.resolve(__dirname, '../../packages/materials/src'),
      '@dissonance/player': path.resolve(__dirname, '../../packages/player/src'),
      '@dissonance/pursuer': path.resolve(__dirname, '../../packages/pursuer/src'),
      '@dissonance/pursuit': path.resolve(__dirname, '../../packages/pursuit/src'),
      '@dissonance/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@dissonance/utils': path.resolve(__dirname, '../../packages/utils/src'),
    },
    // pnpm creates separate symlinks per workspace package; force single instance
    dedupe: ['@babylonjs/core', '@babylonjs/loaders'],
  },
  server: {
    port: 5175,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, '../../')],
    },
  },
  optimizeDeps: {
    // Babylon core, glTF loaders, and WaterMaterial are all native
    // ESM ("type":"module") — excluding prevents the re-optimization loop
    // caused by Vite discovering them via multiple pnpm symlink paths
    exclude: ['@babylonjs/core', '@babylonjs/loaders', '@babylonjs/materials'],
  },
}));
