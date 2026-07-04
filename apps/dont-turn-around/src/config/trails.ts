import type { WorldPosition } from '@dissonance/shared-types';

export type ArtifactId = 'survey_tag' | 'ridge_marker' | 'river_charm';
export type TrailWorldFlavor = 'pine' | 'rocky' | 'river';
export type TrailPursuerProfile = 'stalker' | 'ridge_stalker';
export type TrailAlarmMode = 'continuous_until_visible' | 'manual_chirp';

export type TrailDefinition = {
  id: string;
  name: string;
  menuSummary: string;
  mapPosition: { x: number; y: number };
  startHint: string;
  destinationPosition: WorldPosition;
  artifact: {
    id: ArtifactId;
    name: string;
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
    destinationPosition: { x: 190, y: 0, z: 140 },
    artifact: {
      id: 'survey_tag',
      name: 'survey tag',
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
    destinationPosition: { x: -188, y: 0, z: -118 },
    artifact: {
      id: 'ridge_marker',
      name: 'stone marker',
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
