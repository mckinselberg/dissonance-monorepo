export {
  ScatterVariationMaterialPlugin,
  setScatterVariationBuffer,
} from './ScatterVariationMaterialPlugin';
export type {
  ScatterVariationProfile,
  ScatterVariationRange,
} from './ScatterVariationProfile';
export { DEFAULT_SCATTER_VARIATION_PROFILE } from './ScatterVariationProfile';
export { createScatterMaterial } from './createScatterMaterial';
export type { ScatterMaterialTextures, ScatterMaterialHandle } from './createScatterMaterial';
export { EmissiveDataPatternMaterial } from './EmissiveDataPatternMaterial';
export type { EmissiveDataPatternParams } from './EmissiveDataPatternMaterial';
export { createScrollingTexture } from './createScrollingTexture';
export type { ScrollingTextureParams, ScrollingTextureHandle } from './createScrollingTexture';
export {
  HazeBandFogMaterialPlugin,
  HazeBandFogSceneController,
  attachHazeBandFogToScene,
} from './HazeBandFogMaterialPlugin';
export type {
  FixedFourHazeBands,
  HazeBandFogBand,
  HazeBandFogConfig,
  HazeBandFogDensitySource,
  HazeBandFogMaterial,
} from './HazeBandFogMaterialPlugin';
