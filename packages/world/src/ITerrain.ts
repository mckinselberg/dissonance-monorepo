// The minimal shape every terrain implementation must satisfy. Extracted
// from the procedural Terrain's actual usage across ForestGenerator and
// Game.ts — those call sites only ever use getHeightAt and dispose, never
// anything Terrain-specific (flavor, river distance, etc.), so that's all
// this interface needs to cover.
export interface ITerrain {
  getHeightAt(x: number, z: number): number;
  dispose(): void;
}
