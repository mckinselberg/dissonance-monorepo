import { signal, type Signal } from '@preact/signals';
import type { WorldFeatureRegistry } from '../world/WorldFeatureRegistry';

const LEGACY_STORY_STORAGE_KEY = 'dissonance:world-story-flags:v1';
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FLAG_PATTERN = /^[a-z][A-Za-z0-9]*$/;

export type StoryTrigger =
  | { kind: 'zone-enter'; zoneId: string }
  | { kind: 'system-event'; event: string }
  | { kind: 'interaction'; target: string };

export interface StoryBeat {
  id: string;
  locationId: string;
  trigger: StoryTrigger;
  requires: string[];
  sets: string[];
  once: boolean;
  status: 'planned' | 'implemented';
}

export interface StoryManifest {
  version: 1;
  beats: StoryBeat[];
}

export interface StoryState {
  readonly flags: Signal<readonly string[]>;
  has(flag: string): boolean;
  set(flag: string, enabled?: boolean): void;
  applyBeat(beatId: string): boolean;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`[Story] ${label} must be a non-empty string.`);
  }
  return value;
}

function parseFlags(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`[Story] ${label} must be an array.`);
  const flags = value.map((flag, index) => requireString(flag, `${label}[${index}]`));
  for (const flag of flags) {
    if (!FLAG_PATTERN.test(flag)) {
      throw new Error(`[Story] invalid flag "${flag}" in ${label}; use lower camelCase.`);
    }
  }
  if (new Set(flags).size !== flags.length) throw new Error(`[Story] duplicate flag in ${label}.`);
  return flags;
}

function parseTrigger(value: unknown, beatId: string): StoryTrigger {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`[Story] beat "${beatId}" requires a trigger.`);
  }
  const trigger = value as Record<string, unknown>;
  if (trigger.kind === 'zone-enter') {
    return { kind: trigger.kind, zoneId: requireString(trigger.zoneId, `${beatId}.trigger.zoneId`) };
  }
  if (trigger.kind === 'system-event') {
    return { kind: trigger.kind, event: requireString(trigger.event, `${beatId}.trigger.event`) };
  }
  if (trigger.kind === 'interaction') {
    return { kind: trigger.kind, target: requireString(trigger.target, `${beatId}.trigger.target`) };
  }
  throw new Error(`[Story] beat "${beatId}" has an unknown trigger kind.`);
}

export function parseStoryManifest(
  value: unknown,
  worldFeatures: WorldFeatureRegistry,
): StoryManifest {
  if (typeof value !== 'object' || value === null) throw new Error('[Story] manifest must be an object.');
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) throw new Error(`[Story] unsupported manifest version "${String(raw.version)}".`);
  if (!Array.isArray(raw.beats)) throw new Error('[Story] manifest beats must be an array.');

  const ids = new Set<string>();
  const knownFlags = new Set<string>();
  const beats = raw.beats.map((value, index): StoryBeat => {
    if (typeof value !== 'object' || value === null) {
      throw new Error(`[Story] beat ${index} must be an object.`);
    }
    const beat = value as Record<string, unknown>;
    const id = requireString(beat.id, `beats[${index}].id`);
    if (!ID_PATTERN.test(id)) throw new Error(`[Story] invalid beat id "${id}"; use kebab-case.`);
    if (ids.has(id)) throw new Error(`[Story] duplicate beat id "${id}".`);
    ids.add(id);
    const locationId = requireString(beat.locationId, `${id}.locationId`);
    worldFeatures.require(locationId);
    const requires = parseFlags(beat.requires, `${id}.requires`);
    for (const flag of requires) {
      if (!knownFlags.has(flag)) {
        throw new Error(`[Story] beat "${id}" requires flag "${flag}" before any earlier beat sets it.`);
      }
    }
    const sets = parseFlags(beat.sets, `${id}.sets`);
    sets.forEach((flag) => knownFlags.add(flag));
    if (beat.status !== 'planned' && beat.status !== 'implemented') {
      throw new Error(`[Story] beat "${id}" has invalid status "${String(beat.status)}".`);
    }
    if (typeof beat.once !== 'boolean') throw new Error(`[Story] beat "${id}" once must be boolean.`);
    return {
      id,
      locationId,
      trigger: parseTrigger(beat.trigger, id),
      requires,
      sets,
      once: beat.once,
      status: beat.status,
    };
  });
  return { version: 1, beats };
}

function loadFlags(): string[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((flag): flag is string =>
      typeof flag === 'string' && FLAG_PATTERN.test(flag),
    ))].sort();
  } catch {
    return [];
  }
}

export function createStoryState(
  manifest: StoryManifest,
  persistence?: {
    initialFlags: readonly string[];
    save(flags: readonly string[]): void;
  },
): StoryState {
  const flags = signal<readonly string[]>(persistence?.initialFlags ?? loadFlags());
  const beats = new Map(manifest.beats.map((beat) => [beat.id, beat]));
  const persist = (next: readonly string[]) => {
    flags.value = next;
    if (persistence) persistence.save(next);
    else localStorage.setItem(LEGACY_STORY_STORAGE_KEY, JSON.stringify(next));
  };
  return {
    flags,
    has: (flag) => flags.value.includes(flag),
    set: (flag, enabled = true) => {
      if (!FLAG_PATTERN.test(flag)) throw new Error(`[Story] invalid flag "${flag}".`);
      const next = new Set(flags.value);
      if (enabled) next.add(flag);
      else next.delete(flag);
      persist([...next].sort());
    },
    applyBeat: (beatId) => {
      const beat = beats.get(beatId);
      if (!beat) throw new Error(`[Story] unknown beat "${beatId}".`);
      if (!beat.requires.every((flag) => flags.value.includes(flag))) return false;
      if (beat.once && beat.sets.every((flag) => flags.value.includes(flag))) return false;
      const next = new Set(flags.value);
      beat.sets.forEach((flag) => next.add(flag));
      persist([...next].sort());
      return true;
    },
  };
}
