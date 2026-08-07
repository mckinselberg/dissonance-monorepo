import type { NarrativeEvent, NarrativeState, ReadingCount, WorldManifest } from '../narrative';

// All pure. No helper reads a conclusion, because no conclusion exists in
// state to read (G3).
export const cond = {
  proximityAtLeast: (s: NarrativeState, id: string, n: number) => (s.proximityTicks[id] ?? 0) >= n,
  capabilityHeld: (s: NarrativeState, cap: string) => !!s.capabilities[cap],
  companionKept: (s: NarrativeState, id: string) => !!s.companions[id],
  inZone: (e: NarrativeEvent, z: string) => (e.zone ?? null) === z,
  event: (e: NarrativeEvent, k: string) => e.kind === k,
  notYetFired: (s: NarrativeState, key: string) => s.since[key] === undefined,
  bandAllows: (m: WorldManifest, zone: string | null, rc: ReadingCount) => rc <= (m.bands[zone ?? ''] ?? 4),
};

export const mark = {
  fired: (key: string, t: number) => ({ kind: 'mark-fired', key, t }) as const,
};
