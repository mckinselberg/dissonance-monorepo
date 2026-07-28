import type { WorldPosition } from '@dissonance/shared-types';

export type ArtifactId = 'survey_tag' | 'ridge_marker' | 'river_charm';
export type ArtifactIconKind = 'tag' | 'stone' | 'charm';
export type TrailWorldFlavor = 'pine' | 'rocky' | 'river';
export type TrailPursuerProfile = 'stalker' | 'ridge_stalker';
export type TrailAlarmMode = 'continuous_until_visible' | 'manual_chirp';

export type TrailDefinition = {
  id: string;
  name: string;
  menuSummary: string;
  mapPosition: { x: number; y: number };
  startHint: string;
  // Shown once at trail start alongside the artifact preview — the one
  // thing this specific trail is meant to teach (level 1: phone + being
  // watched; level 2: the key fob; etc). Optional since not every trail
  // needs to introduce something new.
  introNote?: string;
  destinationPosition: WorldPosition;
  // Overrides the default southern-mountain spawn — e.g. Stonejaw Ridge
  // starts the player at their own car instead.
  spawnPosition?: WorldPosition;
  artifact: {
    id: ArtifactId;
    name: string;
    icon: ArtifactIconKind;
    position: WorldPosition;
  };
  waypoints: WorldPosition[];
  pursuerProfile: TrailPursuerProfile;
  worldFlavor: TrailWorldFlavor;
  alarmMode: TrailAlarmMode;
};

export const TRAILS: Record<string, TrailDefinition> = {
  morrow_pine_loop: {
    id: 'morrow_pine_loop',
    name: 'Morrow Pine Loop',
    menuSummary: 'dense pine loop / survey tag',
    mapPosition: { x: 0.62, y: 0.48 },
    startHint: 'Follow the alarm. Find the survey tag. When you can see the car, press F to silence it.',
    introNote: 'Your phone is on the ground nearby — pick it up and right-click to use it as a flashlight. If you ever see eyes watching from the dark, something in these woods has noticed you.',
    destinationPosition: { x: 190, y: 0, z: 140 },
    artifact: {
      id: 'survey_tag',
      name: 'survey tag',
      icon: 'tag',
      position: { x: -154, y: 0, z: 38 },
    },
    waypoints: [
      { x: 8, y: 0, z: 6 },
      { x: 72, y: 0, z: 56 },
      { x: 152, y: 0, z: 114 },
      { x: -58, y: 0, z: 52 },
      { x: -154, y: 0, z: 38 },
    ],
    pursuerProfile: 'stalker',
    worldFlavor: 'pine',
    alarmMode: 'continuous_until_visible',
  },
  stonejaw_ridge: {
    id: 'stonejaw_ridge',
    name: 'Stonejaw Ridge',
    menuSummary: 'rocky ridge trail / stone marker',
    mapPosition: { x: 0.32, y: 0.28 },
    startHint: 'Press F to chirp the car alarm. Use it to find the ridge lot after the stone marker.',
    introNote: 'You start at the car this time. The key fob (F) chirps the alarm on demand — use it on the way back if you lose track of the lot.',
    destinationPosition: { x: -188, y: 0, z: -118 },
    spawnPosition: { x: -180, y: 0, z: -118 },
    artifact: {
      id: 'ridge_marker',
      name: 'stone marker',
      icon: 'stone',
      position: { x: 180, y: 0, z: 135 },
    },
    waypoints: [
      { x: 8, y: 0, z: 6 },
      { x: 40, y: 0, z: 30 },
      { x: 72, y: 0, z: 56 },
      { x: 114, y: 0, z: 86 },
      { x: 152, y: 0, z: 114 },
      { x: 180, y: 0, z: 135 },
    ],
    pursuerProfile: 'ridge_stalker',
    worldFlavor: 'rocky',
    alarmMode: 'manual_chirp',
  },
  blackwater_spur: {
    id: 'blackwater_spur',
    name: 'Blackwater Spur',
    menuSummary: 'river spur / missing charm',
    mapPosition: { x: 0.48, y: 0.68 },
    startHint: 'Press F to chirp the car alarm. Cross the creek stones and recover the river charm.',
    destinationPosition: { x: -168, y: 0, z: 164 },
    artifact: {
      id: 'river_charm',
      name: 'river charm',
      icon: 'charm',
      position: { x: 118, y: 0, z: -12 },
    },
    waypoints: [
      { x: 2, y: 0, z: -8 },
      { x: -18, y: 0, z: 42 },
      { x: -42, y: 0, z: 82 },
      { x: 18, y: 0, z: 28 },
      { x: 74, y: 0, z: 4 },
      { x: 118, y: 0, z: -12 },
    ],
    pursuerProfile: 'stalker',
    worldFlavor: 'river',
    alarmMode: 'manual_chirp',
  },
};

export const DEFAULT_TRAIL_ID = 'morrow_pine_loop';
