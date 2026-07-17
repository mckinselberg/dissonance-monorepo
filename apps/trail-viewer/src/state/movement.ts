import { signal, type Signal } from '@preact/signals';

export type ActiveMode = 'walk' | 'fly' | 'drive';

// Backs the movement-mode row (main.tsx's player-mode branch only — orbit
// mode has no equivalent of either of these). worldBounded is NOT included
// here despite belonging to the same UI row: it's needed earlier, in code
// shared by both orbit and player mode (clampToWorldBounds is defined
// before the orbit-vs-player branch even splits), while activeMode/
// cameraHeightOffset are only ever declared inside the player-mode branch —
// so main.tsx creates worldBounded as its own standalone signal instead.
export type MovementSignals = {
  activeMode: Signal<ActiveMode>;
  cameraHeightOffset: Signal<number>;
};

export function createMovementSignals(defaults: {
  activeMode: ActiveMode;
  cameraHeightOffset: number;
}): MovementSignals {
  return {
    activeMode: signal(defaults.activeMode),
    cameraHeightOffset: signal(defaults.cameraHeightOffset),
  };
}
