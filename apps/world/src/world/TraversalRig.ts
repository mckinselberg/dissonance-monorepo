import { Vector3, type FreeCamera, type Scene } from '@babylonjs/core';
import type { ITerrain } from '@dissonance/world';
import type { PlayerController, FlightController, DriveController } from '@dissonance/player';
import { createMovementSignals, type ActiveMode, type MovementSignals } from '../state/movement';

// Structural shape shared by all three controllers — lets switchMode below
// treat them uniformly instead of branching per mode.
export interface TraversalController {
  readonly camera: FreeCamera;
  update(dt: number): void;
  getPosition(): Vector3;
  setPosition(pos: Vector3): void;
  clearLookDelta(): void;
}

export type TraversalRig = {
  controllers: Record<ActiveMode, TraversalController>;
  movement: MovementSignals;
  switchMode(newMode: ActiveMode): void;
};

// Owns Walk/Fly/Drive mode-switching — all three controllers stay alive
// simultaneously (see main.tsx's own comment on FlightController/
// DriveController construction), so switching is just a position/rotation
// handoff plus an active-camera swap, never a construct/destroy.
export function createTraversalRig(
  scene: Scene,
  terrain: ITerrain,
  player: PlayerController,
  flight: FlightController,
  drive: DriveController,
  savedSettings: { activeMode?: ActiveMode; cameraHeightOffset?: number },
): TraversalRig {
  // Extra lift on top of both grounded controllers' own (scale-adjusted)
  // eye height — levels with a shrunk player (playerScale < 1) otherwise
  // put the camera uncomfortably close to the ground.
  const movement = createMovementSignals({
    activeMode: 'walk',
    cameraHeightOffset: savedSettings.cameraHeightOffset ?? 1.5,
  });
  player.setHeightOffset(movement.cameraHeightOffset.value);
  drive.setHeightOffset(movement.cameraHeightOffset.value);

  const controllers: Record<ActiveMode, TraversalController> = { walk: player, fly: flight, drive };
  scene.activeCamera = player.camera;

  const switchMode = (newMode: ActiveMode): void => {
    if (newMode === movement.activeMode.value) return;
    const from = controllers[movement.activeMode.value];
    const to = controllers[newMode];
    const pos = from.getPosition();
    if (newMode === 'fly') {
      // Hover right where the previous controller left off.
      to.setPosition(pos);
    } else {
      // Landing (Walk/Drive are both grounded) — snap to the terrain at
      // this XZ immediately rather than leaving a mid-air position visible
      // even for one frame.
      const groundY = terrain.getHeightAt(pos.x, pos.z);
      to.setPosition(new Vector3(pos.x, groundY, pos.z));
    }
    to.camera.rotation.copyFrom(from.camera.rotation);
    to.clearLookDelta();
    movement.activeMode.value = newMode;
    scene.activeCamera = to.camera;
  };

  // Restore whichever mode was active last session, if any.
  const validModes: ActiveMode[] = ['walk', 'fly', 'drive'];
  if (savedSettings.activeMode && validModes.includes(savedSettings.activeMode)) {
    switchMode(savedSettings.activeMode);
  }

  return { controllers, movement, switchMode };
}
