import type { WorldPosition } from '@dissonance/shared-types';

export type ArtifactId = 'survey_tag';

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
  },
};

export const DEFAULT_TRAIL_ID = 'morrow_pine_loop';
