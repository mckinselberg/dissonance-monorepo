import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Dev-only proof-of-concept for the instanced-material pipeline
  // (docs/dissonance/instanced-material-pipeline-prompt-v1.md) — not wired
  // into render.yaml, not a shipped diorama layer.
  base: '/',
  resolve: {
    alias: {
      '@dissonance/materials': path.resolve(__dirname, '../../packages/materials/src'),
    },
    dedupe: ['@babylonjs/core'],
  },
  server: {
    port: 5177,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, '../../')],
    },
  },
  optimizeDeps: {
    exclude: ['@babylonjs/core'],
  },
});
