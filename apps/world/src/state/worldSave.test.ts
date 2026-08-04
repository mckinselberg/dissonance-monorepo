import { beforeEach, describe, expect, it } from 'vitest';
import { WorldSaveStore, type WorldSaveMigrationSeed } from './worldSave';

const WORLD_SAVE_KEY = 'dissonance:world-save:v1';

function installMemoryLocalStorage(): void {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
}

const seed: WorldSaveMigrationSeed = { levelKey: 'level-1', runSeed: 42 };

const DEFAULT_VEHICLE = { distanceMeters: 0, fuelFraction: 1, travelMode: 'careful', stranded: false };

describe('WorldSaveStore vehicle state (v1 -> v2)', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it('migrates a fresh (no prior save) document to v2 with a default vehicle block', () => {
    const store = new WorldSaveStore(seed);
    const snapshot = store.snapshot();
    expect(snapshot.version).toBe(2);
    expect(snapshot.vehicle).toEqual(DEFAULT_VEHICLE);
  });

  it('round-trips vehicle state through setVehicleState', () => {
    const store = new WorldSaveStore(seed);
    store.setVehicleState({ distanceMeters: 42.5, fuelFraction: 0.3, travelMode: 'reckless', stranded: true });
    expect(store.snapshot().vehicle).toEqual({ distanceMeters: 42.5, fuelFraction: 0.3, travelMode: 'reckless', stranded: true });
  });

  it('upgrades a stored v1 document (no vehicle field) to v2, preserving the rest of the document', () => {
    localStorage.setItem(WORLD_SAVE_KEY, JSON.stringify({
      version: 1,
      savedAt: 111,
      activeRoute: 'exterior',
      lastExterior: null,
      equipment: { flashlightEnabled: false },
      strike: { runSeed: 7, anchorId: 'anchor-1', windupSeconds: 3, recoverablePosition: null },
      progression: { storyFlags: ['flagA'], inventory: { lineglassPartIds: [], hardwareIds: [] } },
    }));
    const store = new WorldSaveStore(seed);
    const snapshot = store.snapshot();
    expect(snapshot.version).toBe(2);
    expect(snapshot.vehicle).toEqual(DEFAULT_VEHICLE);
    expect(snapshot.equipment.flashlightEnabled).toBe(false);
    expect(snapshot.strike.anchorId).toBe('anchor-1');
    expect(snapshot.progression.storyFlags).toEqual(['flagA']);
  });

  it('persists vehicle state across a reload (a new store instance reads back the same document)', () => {
    const first = new WorldSaveStore(seed);
    first.setVehicleState({ distanceMeters: 10, fuelFraction: 0.5, travelMode: 'fast', stranded: false });
    const second = new WorldSaveStore(seed);
    expect(second.snapshot().vehicle).toEqual({ distanceMeters: 10, fuelFraction: 0.5, travelMode: 'fast', stranded: false });
  });

  it('rejects a malformed stored vehicle block and falls back to defaults', () => {
    localStorage.setItem(WORLD_SAVE_KEY, JSON.stringify({
      version: 2,
      savedAt: 111,
      activeRoute: 'exterior',
      lastExterior: null,
      equipment: { flashlightEnabled: true },
      strike: { runSeed: 7, anchorId: null, windupSeconds: null, recoverablePosition: null },
      vehicle: { distanceMeters: -5, fuelFraction: 3, travelMode: 'nonsense', stranded: 'yes' },
      progression: { storyFlags: [], inventory: { lineglassPartIds: [], hardwareIds: [] } },
    }));
    const store = new WorldSaveStore(seed);
    expect(store.snapshot().vehicle).toEqual(DEFAULT_VEHICLE);
  });
});
