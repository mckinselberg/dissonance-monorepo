import type { WorldManifest } from '../narrative';

// First real manifest: no zone narrows the band yet, so every zone defaults
// to the widest reading count (4) per reduce.ts's own thematic default.
// Zone-specific narrowing (Synod-core zones toward 1) arrives with T23's
// region system — see THREADS.md T40/O30 (derive-up vs gate-down, still open).
export const worldManifest: WorldManifest = {
  bands: {},
};
