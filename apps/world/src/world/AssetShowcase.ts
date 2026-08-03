import { Vector3, type Scene, type ShadowGenerator } from '@babylonjs/core';
import type { LocationEntry } from './LocationProps';
import { loadHeroTreeInstances, type HeroTreeInstancesHandle } from './HeroTreeInstances';

// Dev-only visual QA tool (see LocationProps.ts's `assetShowcase` field
// comment): one instance of each named asset, row-major grid, centered on
// the owning location. No colliders — this is for eyeballing a freshly
// imported pack side-by-side, not a real placement.
export interface AssetShowcaseHandle {
  dispose(): void;
}

export function loadAssetShowcase(
  scene: Scene,
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
  getHeightAt: (x: number, z: number) => number,
  shadowGenerator?: ShadowGenerator,
): AssetShowcaseHandle {
  let disposed = false;
  const handles: HeroTreeInstancesHandle[] = [];

  for (const location of locations) {
    const showcase = location.assetShowcase;
    if (!showcase) continue;
    const anchor = toRenderXZ(location.latLong[0], location.latLong[1]);
    const rows = Math.ceil(showcase.assetUrls.length / showcase.columns);
    // Grid centered on the anchor rather than growing from a corner, so the
    // location's latLong reads as "the middle of the demo," matching how
    // every other location anchor behaves.
    const originCol = -(showcase.columns - 1) / 2;
    const originRow = -(rows - 1) / 2;

    showcase.assetUrls.forEach((assetUrl, index) => {
      const col = index % showcase.columns;
      const row = Math.floor(index / showcase.columns);
      const realX = (originCol + col) * showcase.spacingMeters;
      const realZ = (originRow + row) * showcase.spacingMeters;
      const x = anchor.x + realX * horizontalScale;
      const z = anchor.z + realZ * horizontalScale;
      // assetUrls are stored relative to BASE_URL in locations.json (same
      // convention as every other model path in this app), not as full URLs.
      void loadHeroTreeInstances(
        scene,
        `${import.meta.env.BASE_URL}${assetUrl}`,
        [new Vector3(x, getHeightAt(x, z), z)],
        horizontalScale,
        horizontalScale,
        shadowGenerator,
      )
        .then((handle) => {
          if (disposed) handle.dispose();
          else handles.push(handle);
        })
        .catch((error) => {
          console.error(`[AssetShowcase] failed to load ${assetUrl}`, error);
        });
    });
  }

  return {
    dispose() {
      disposed = true;
      handles.forEach((handle) => handle.dispose());
    },
  };
}
