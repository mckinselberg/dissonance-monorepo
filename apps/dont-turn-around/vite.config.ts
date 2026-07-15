import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig(({ command }) => ({
  // Served at /dont-turn-around/ on the shared Render static site.
  // Dev uses the same base so the home app can proxy this route locally.
  base: '/dont-turn-around/',
  resolve: {
    alias: {
      '@dissonance/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@dissonance/engine':       path.resolve(__dirname, '../../packages/engine/src'),
      '@dissonance/world':        path.resolve(__dirname, '../../packages/world/src'),
      '@dissonance/player':       path.resolve(__dirname, '../../packages/player/src'),
      '@dissonance/audio':        path.resolve(__dirname, '../../packages/audio/src'),
      '@dissonance/input':        path.resolve(__dirname, '../../packages/input/src'),
      '@dissonance/navigation':   path.resolve(__dirname, '../../packages/navigation/src'),
      '@dissonance/persistence':  path.resolve(__dirname, '../../packages/persistence/src'),
      '@dissonance/pursuit':      path.resolve(__dirname, '../../packages/pursuit/src'),
      '@dissonance/glow':         path.resolve(__dirname, '../../packages/glow/src'),
    },
    // pnpm creates separate symlinks per workspace package; force single instance
    dedupe: ['@babylonjs/core', '@babylonjs/loaders', 'tone'],
  },
  server: {
    port: 5174,
    strictPort: true,
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
}));
