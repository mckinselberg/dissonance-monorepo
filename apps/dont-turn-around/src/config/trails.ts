import type { WorldPosition } from '@dissonance/shared-types';

export type ArtifactId = 'survey_tag' | 'ridge_marker';
export type TrailWorldFlavor = 'pine' | 'rocky';

export type TrailDefinition = {
  id: string;
  name: string;
  startHint: string;
  destinationPosition: WorldPosition;
  artifact: {
    id: ArtifactId;
    name: string;
    position: WorldPosition;
  };
  waypoints: WorldPosition[];
  pursuerProfile: 'stalker';
  worldFlavor: TrailWorldFlavor;
};

export const TRAILS: Record<string, TrailDefinition> = {
  morrow_pine_loop: {
    id: 'morrow_pine_loop',
    name: 'Morrow Pine Loop',
    startHint: 'Follow the alarm. Find the survey tag. Get back to the car.',
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
  },
  stonejaw_ridge: {
    id: 'stonejaw_ridge',
    name: 'Stonejaw Ridge',
    startHint: 'Follow the alarm through the ridge trail. Find the stone marker. Get back to the car.',
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
    pursuerProfile: 'stalker',
    worldFlavor: 'rocky',
  },
};

export const DEFAULT_TRAIL_ID = 'morrow_pine_loop';
