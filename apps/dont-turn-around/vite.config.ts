import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@dta/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@dta/engine':       path.resolve(__dirname, '../../packages/engine/src'),
      '@dta/world':        path.resolve(__dirname, '../../packages/world/src'),
      '@dta/player':       path.resolve(__dirname, '../../packages/player/src'),
      '@dta/audio':        path.resolve(__dirname, '../../packages/audio/src'),
      '@dta/input':        path.resolve(__dirname, '../../packages/input/src'),
      '@dta/navigation':   path.resolve(__dirname, '../../packages/navigation/src'),
      '@dta/persistence':  path.resolve(__dirname, '../../packages/persistence/src'),
    },
    // pnpm creates separate symlinks per workspace package; force single instance
    dedupe: ['@babylonjs/core', '@babylonjs/loaders', 'tone'],
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '../../')],
    },
  },
  optimizeDeps: {
    // @babylonjs/core is native ESM ("type":"module") — excluding prevents the
    // re-optimization loop caused by Vite discovering it via 4 different pnpm symlink paths
    exclude: ['@babylonjs/core', '@babylonjs/loaders'],
    include: ['tone'],
  },
});
