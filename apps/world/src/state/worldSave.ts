import type { ActiveMode } from './movement';

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

export interface WorldSaveDocument {
  version: 1;
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

function parsePosition(value: unknown): { x: number; y: number; z: number } | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as { x?: unknown; y?: unknown; z?: unknown };
  if (![raw.x, raw.y, raw.z].every(Number.isFinite)) return null;
  return { x: raw.x as number, y: raw.y as number, z: raw.z as number };
}

function parseDocument(value: unknown, fallbackRunSeed = 0): WorldSaveDocument | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Partial<WorldSaveDocument>;
  if (raw.version !== 1 || !['exterior', 'workshop', 'surveillance'].includes(raw.activeRoute ?? '')) {
    return null;
  }
  const progression = raw.progression;
  if (!progression || typeof progression !== 'object') return null;
  const inventory = progression.inventory;
  if (!inventory || typeof inventory !== 'object') return null;
  const storyFlags = uniqueStrings(progression.storyFlags);
  return {
    version: 1,
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
    version: 1,
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

  private update(document: WorldSaveDocument): void {
    this.document = { ...document, savedAt: Date.now() };
    this.persist();
  }

  private persist(): void {
    localStorage.setItem(WORLD_SAVE_KEY, JSON.stringify(this.document));
  }
}
