import type { LocationEntry } from './LocationProps';

const FEATURE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class WorldFeatureRegistry {
  private readonly entriesById = new Map<string, LocationEntry>();

  constructor(readonly entries: LocationEntry[]) {
    for (const entry of entries) {
      if (!FEATURE_ID_PATTERN.test(entry.id)) {
        throw new Error(
          `[WorldFeatureRegistry] invalid id "${entry.id}" for "${entry.name}"; ` +
          'use lowercase kebab-case',
        );
      }
      if (this.entriesById.has(entry.id)) {
        throw new Error(`[WorldFeatureRegistry] duplicate feature id "${entry.id}"`);
      }
      if (
        !Array.isArray(entry.latLong) ||
        entry.latLong.length !== 2 ||
        !entry.latLong.every(Number.isFinite)
      ) {
        throw new Error(`[WorldFeatureRegistry] invalid latLong for feature "${entry.id}"`);
      }
      this.entriesById.set(entry.id, entry);
    }
  }

  get(id: string): LocationEntry | undefined {
    return this.entriesById.get(id);
  }

  require(id: string): LocationEntry {
    const entry = this.get(id);
    if (!entry) throw new Error(`[WorldFeatureRegistry] unknown feature id "${id}"`);
    return entry;
  }
}
