let gltfLoaderReady: Promise<unknown> | null = null;

// Same one-dynamic-import-per-session pattern as trail-viewer's gltfLoader.ts.
export async function ensureGltfLoader(): Promise<void> {
  gltfLoaderReady ??= import('@babylonjs/loaders/glTF/index.js');
  await gltfLoaderReady;
}
