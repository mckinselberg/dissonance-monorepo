let gltfLoaderReady: Promise<unknown> | null = null;

// This module is bundled by Vite and served from World's own origin —
// shared by every GLB loader in this app so the dynamic import only ever
// resolves once per session, however many callers need it.
export async function ensureGltfLoader(): Promise<void> {
  gltfLoaderReady ??= import('@babylonjs/loaders/glTF/index.js');
  await gltfLoaderReady;
}
