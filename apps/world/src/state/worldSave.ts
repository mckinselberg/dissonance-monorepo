import type { ActiveMode } from './movement';
import type { VehicleTravelMode } from '../vehicle/vehicleProfile';

const WORLD_SAVE_KEY = 'dissonance:world-save:v1';
const LEGACY_STORY_KEY = 'dissonance:world-story-flags:v1';

export const WORLD_HARDWARE_IDS = {
  patrolDroneEmitter: 'patrol-drone-emitter',
  boulevardPatrolDroneChassis: 'boulevard-patrol-01-chassis',
} as const;

export type WorldRouteId = 'exterior' | 'workshop' | 'surveillance';

export interface ExteriorPlayerState {
  levelKey: string;
  mode: ActiveMode;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

// Fuel is stored as a fraction of capacity (0..1) rather than an absolute
// amount so the save stays valid across vehicle-profile tuning (Dev HUD
// JSON edits, or a future profile revision) instead of silently meaning a
// different real amount of fuel than what was actually saved.
export interface VehicleSaveState {
  distanceMeters: number;
  fuelFraction: number;
  travelMode: VehicleTravelMode;
  stranded: boolean;
}

export interface WorldSaveDocument {
  version: 2;
  savedAt: number;
  activeRoute: WorldRouteId;
  lastExterior: ExteriorPlayerState | null;
  equipment: {
    flashlightEnabled: boolean;
  };
  strike: {
    runSeed: number;
    anchorId: string | null;
    windupSeconds: number | null;
    recoverablePosition: { x: number; y: number; z: number } | null;
  };
  vehicle: VehicleSaveState;
  progression: {
    storyFlags: string[];
    inventory: {
      lineglassPartIds: string[];
      hardwareIds: string[];
    };
  };
}

export interface WorldSaveMigrationSeed {
  levelKey: string;
  mode?: ActiveMode;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  lineglassPartIds?: string[];
  runSeed: number;
}

const uniqueStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string =>
        typeof entry === 'string' && entry.length > 0,
      ))].sort()
    : [];

function normalizeHardwareIds(value: unknown, storyFlags: readonly string[]): string[] {
  const hardwareIds = new Set(uniqueStrings(value));
  if (storyFlags.includes('emitterAcquired')) {
    hardwareIds.add(WORLD_HARDWARE_IDS.patrolDroneEmitter);
  }
  if (storyFlags.includes('chassisRecovered')) {
    hardwareIds.add(WORLD_HARDWARE_IDS.boulevardPatrolDroneChassis);
  }
  return [...hardwareIds].sort();
}

function parseExterior(value: unknown): ExteriorPlayerState | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Partial<ExteriorPlayerState>;
  if (
    typeof raw.levelKey !== 'string' ||
    !['walk', 'fly', 'drive'].includes(raw.mode ?? '') ||
    !raw.position ||
    !raw.rotation ||
    ![raw.position.x, raw.position.y, raw.position.z, raw.rotation.x, raw.rotation.y, raw.rotation.z]
      .every(Number.isFinite)
  ) return null;
  return raw as ExteriorPlayerState;
}

function defaultVehicleState(): VehicleSaveState {
  return { distanceMeters: 0, fuelFraction: 1, travelMode: 'careful', stranded: false };
}

function parseVehicleState(value: unknown): VehicleSaveState {
  const fallback = defaultVehicleState();
  if (typeof value !== 'object' || value === null) return fallback;
  const raw = value as Partial<VehicleSaveState>;
  const distanceMeters = Number.isFinite(raw.distanceMeters) && (raw.distanceMeters as number) >= 0
    ? raw.distanceMeters as number
    : fallback.distanceMeters;
  const fuelFraction = Number.isFinite(raw.fuelFraction) && (raw.fuelFraction as number) >= 0 && (raw.fuelFraction as number) <= 1
    ? raw.fuelFraction as number
    : fallback.fuelFraction;
  const travelMode: VehicleTravelMode =
    raw.travelMode === 'careful' || raw.travelMode === 'fast' || raw.travelMode === 'reckless'
      ? raw.travelMode
      : fallback.travelMode;
  const stranded = typeof raw.stranded === 'boolean' ? raw.stranded : fallback.stranded;
  return { distanceMeters, fuelFraction, travelMode, stranded };
}

function parsePosition(value: unknown): { x: number; y: number; z: number } | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as { x?: unknown; y?: unknown; z?: unknown };
  if (![raw.x, raw.y, raw.z].every(Number.isFinite)) return null;
  return { x: raw.x as number, y: raw.y as number, z: raw.z as number };
}

function parseDocument(value: unknown, fallbackRunSeed = 0): WorldSaveDocument | null {
  if (typeof value !== 'object' || value === null) return null;
  const rawVersion = (value as { version?: unknown }).version;
  // Accepts a stored v1 doc (pre-dates the `vehicle` block) and upgrades it
  // in place — parseVehicleState defaults a missing/absent `vehicle` field
  // to a fresh, unstranded, full-tank vehicle rather than falling through
  // to migrate() and losing the rest of the v1 document's state.
  if (rawVersion !== 1 && rawVersion !== 2) return null;
  const raw = value as Partial<WorldSaveDocument>;
  if (!['exterior', 'workshop', 'surveillance'].includes(raw.activeRoute ?? '')) {
    return null;
  }
  const progression = raw.progression;
  if (!progression || typeof progression !== 'object') return null;
  const inventory = progression.inventory;
  if (!inventory || typeof inventory !== 'object') return null;
  const storyFlags = uniqueStrings(progression.storyFlags);
  return {
    version: 2,
    savedAt: Number.isFinite(raw.savedAt) ? raw.savedAt as number : Date.now(),
    activeRoute: raw.activeRoute as WorldRouteId,
    lastExterior: parseExterior(raw.lastExterior),
    equipment: {
      flashlightEnabled:
        typeof raw.equipment?.flashlightEnabled === 'boolean'
          ? raw.equipment.flashlightEnabled
          : true,
    },
    strike: {
      runSeed: Number.isInteger(raw.strike?.runSeed) && (raw.strike?.runSeed ?? -1) >= 0
        ? raw.strike!.runSeed
        : fallbackRunSeed,
      anchorId: typeof raw.strike?.anchorId === 'string' ? raw.strike.anchorId : null,
      windupSeconds: Number.isFinite(raw.strike?.windupSeconds)
        ? raw.strike!.windupSeconds
        : null,
      recoverablePosition: parsePosition(raw.strike?.recoverablePosition),
    },
    vehicle: parseVehicleState(raw.vehicle),
    progression: {
      storyFlags,
      inventory: {
        lineglassPartIds: uniqueStrings(inventory.lineglassPartIds),
        hardwareIds: normalizeHardwareIds(inventory.hardwareIds, storyFlags),
      },
    },
  };
}

function readLegacyStoryFlags(): string[] {
  try {
    return uniqueStrings(JSON.parse(localStorage.getItem(LEGACY_STORY_KEY) ?? '[]') as unknown);
  } catch {
    return [];
  }
}

function migrate(seed: WorldSaveMigrationSeed): WorldSaveDocument {
  const storyFlags = readLegacyStoryFlags();
  const hardwareIds = normalizeHardwareIds([], storyFlags);
  const hasTransform = seed.position && seed.rotation && [
    seed.position.x, seed.position.y, seed.position.z,
    seed.rotation.x, seed.rotation.y, seed.rotation.z,
  ].every(Number.isFinite);
  return {
    version: 2,
    savedAt: Date.now(),
    activeRoute: 'exterior',
    lastExterior: hasTransform ? {
      levelKey: seed.levelKey,
      mode: seed.mode ?? 'walk',
      position: seed.position!,
      rotation: seed.rotation!,
    } : null,
    equipment: {
      flashlightEnabled: true,
    },
    strike: {
      runSeed: seed.runSeed,
      anchorId: null,
      windupSeconds: null,
      recoverablePosition: null,
    },
    vehicle: defaultVehicleState(),
    progression: {
      storyFlags,
      inventory: {
        lineglassPartIds: uniqueStrings(seed.lineglassPartIds),
        hardwareIds,
      },
    },
  };
}

export class WorldSaveStore {
  private document: WorldSaveDocument;

  constructor(seed: WorldSaveMigrationSeed) {
    let loaded: WorldSaveDocument | null = null;
    try {
      loaded = parseDocument(
        JSON.parse(localStorage.getItem(WORLD_SAVE_KEY) ?? 'null') as unknown,
        seed.runSeed,
      );
    } catch {
      loaded = null;
    }
    this.document = loaded ?? migrate(seed);
    this.persist();
  }

  snapshot(): WorldSaveDocument {
    return structuredClone(this.document);
  }

  setActiveRoute(activeRoute: WorldRouteId): void {
    this.update({ ...this.document, activeRoute });
  }

  setLastExterior(lastExterior: ExteriorPlayerState): void {
    this.update({ ...this.document, lastExterior });
  }

  saveRuntime(activeRoute: WorldRouteId, lastExterior?: ExteriorPlayerState): void {
    this.update({
      ...this.document,
      activeRoute,
      lastExterior: lastExterior ?? this.document.lastExterior,
    });
  }

  setStoryFlags(storyFlags: readonly string[]): void {
    const normalizedFlags = uniqueStrings(storyFlags);
    const hardwareIds = normalizeHardwareIds(
      this.document.progression.inventory.hardwareIds,
      normalizedFlags,
    );
    this.update({
      ...this.document,
      progression: {
        ...this.document.progression,
        storyFlags: normalizedFlags,
        inventory: {
          ...this.document.progression.inventory,
          hardwareIds,
        },
      },
    });
  }

  setLineglassPartIds(lineglassPartIds: readonly string[]): void {
    this.update({
      ...this.document,
      progression: {
        ...this.document.progression,
        inventory: {
          ...this.document.progression.inventory,
          lineglassPartIds: uniqueStrings(lineglassPartIds),
        },
      },
    });
  }

  setFlashlightEnabled(flashlightEnabled: boolean): void {
    this.update({
      ...this.document,
      equipment: { flashlightEnabled },
    });
  }

  setStrikeProgress(strike: WorldSaveDocument['strike']): void {
    this.update({ ...this.document, strike: structuredClone(strike) });
  }

  setVehicleState(vehicle: VehicleSaveState): void {
    this.update({ ...this.document, vehicle: { ...vehicle } });
  }

  private update(document: WorldSaveDocument): void {
    this.document = { ...document, savedAt: Date.now() };
    this.persist();
  }

  private persist(): void {
    localStorage.setItem(WORLD_SAVE_KEY, JSON.stringify(this.document));
  }
}
