import type { Scene, ShadowGenerator, Vector3 } from '@babylonjs/core';
import { AudioEngine } from '@dissonance/audio';
import { PursuerSystem, type PursuerConfig } from '@dissonance/pursuit';
import type { PursuerModel } from '@dissonance/shared-types';
import { signal, type Signal } from '@preact/signals';
import { MechDogBody, type MechDogSkin } from './MechDogBody';
import { WHISTLE_MELODIES } from '../state/whistle';

// World's first pursuer slice deliberately keeps the behavior small: the
// dog closes from directly ahead, then holds a readable standoff instead of
// triggering DTA's catch/end-run flow. The reusable movement state machine
// remains in @dissonance/pursuit; World owns this tuning and presentation.
const WORLD_MECH_DOG_CONFIG: PursuerConfig = {
  startDistance: 12,
  baseSpeed: 2.6,
  maxSpeed: 7.5,
  catchRadius: 0.5,
  nearThreshold: 20,
  closeThreshold: 8,
  sprintAggressionGain: 0.016,
  stillAggressionLoss: 0.006,
  aggressionDecayRate: 0.002,
  stunMin: 0.8,
  stunRange: 0.4,
  orbitStrength: 0.2,
  reengageDelay: 1,
};
const MECH_DOG_STANDOFF_DISTANCE = 3.5;
const MECH_DOG_VISUAL_HEIGHT = 0.65;
// 'P' only does something within this range — petting from across the
// clearing doesn't make sense. Loose enough to allow for the dog's own
// standoff-distance wobble around the player.
const PET_DISTANCE = 4;

// Candidate stand-off distances the dog tries (nearest first) when picking
// where to spawn ahead of the player — falls back to the last (closest) one
// if every longer distance's sightline is blocked by terrain.
const SPAWN_CANDIDATE_DISTANCES = [12, 10, 8, 6, 4];

// Minimal shape MechDogController needs from whichever traversal
// controller is currently active — matches PlayerController/
// FlightController/DriveController's own camera field structurally,
// without coupling this file to main.tsx's TraversalController type.
export interface MechDogTarget {
  getPosition(): Vector3;
  camera: { getForwardRay(): { direction: Vector3 } };
}

// Owns the mech dog's pursuit state machine (@dissonance/pursuit), its
// visual body (MechDogBody), and the whistle/pet/skin session state around
// it. Player-mode-only (see main.tsx — orbit mode never constructs this).
export class MechDogController {
  // Index into WHISTLE_MELODIES — number keys 1-9 change it, 'M' plays
  // whichever one it currently points at. Session-only; not worth a
  // SavedSettings field yet.
  readonly whistleMelodyIndex = signal(0);

  private readonly body: MechDogBody;
  private readonly pursuit: PursuerSystem;
  private readonly position: { x: number; z: number };
  private spawned = false;
  private lastTargetX: number;
  private lastTargetZ: number;

  constructor(
    scene: Scene,
    shadowGenerator: ShadowGenerator | undefined,
    initialTargetPosition: Vector3,
    initialVisible: boolean,
    // Created early in main() (rather than owned here) because the shared
    // Toggles-section HUD reads `skin.value` synchronously in a <select
    // value=...> — a plain prop read, not a closure — so it needs to exist
    // before this controller itself does. Same rig/animations either way;
    // 'default' reads as the menacing mech pursuer, 'black' closer to a
    // plain pet dog.
    readonly skin: Signal<MechDogSkin>,
  ) {
    this.position = { x: initialTargetPosition.x, z: initialTargetPosition.z };
    this.lastTargetX = initialTargetPosition.x;
    this.lastTargetZ = initialTargetPosition.z;
    this.pursuit = new PursuerSystem(WORLD_MECH_DOG_CONFIG, WORLD_MECH_DOG_CONFIG.startDistance);
    this.body = new MechDogBody(scene, shadowGenerator, this.skin.value);
    this.body.setVisible(initialVisible);
  }

  setVisible(visible: boolean): void {
    this.body.setVisible(visible);
  }

  setSkin(skin: MechDogSkin): void {
    this.skin.value = skin;
    this.body.setSkin(skin);
  }

  selectMelody(index: number): void {
    if (index < WHISTLE_MELODIES.length) this.whistleMelodyIndex.value = index;
  }

  whistle(): void {
    AudioEngine.playWhistleMelody(WHISTLE_MELODIES[this.whistleMelodyIndex.value].notes);
    this.body.reactToWhistle();
  }

  tryPet(): void {
    if (this.pursuit.getModel().distance < PET_DISTANCE) this.body.reactToPet();
  }

  isPettable(): boolean {
    return this.pursuit.getModel().distance < PET_DISTANCE;
  }

  getModel(): PursuerModel {
    return this.pursuit.getModel();
  }

  // Real (unscaled by hScale) — a rescale just moves the dog proportionally
  // like everything else in render space (see main.tsx's rebuildWorld).
  rescale(horizontalScaleRatio: number): void {
    this.position.x *= horizontalScaleRatio;
    this.position.z *= horizontalScaleRatio;
  }

  update(
    dt: number,
    target: MechDogTarget,
    targetIsCrouching: boolean,
    getHeightAt: (x: number, z: number) => number,
  ): void {
    const pos = target.getPosition();

    // The concrete spawn is selected on the first update() call, after the
    // active controller has grounded/raised its camera — using camera Y at
    // construction time would test sightlines from the terrain surface
    // instead of from the player's actual eye.
    if (!this.spawned) {
      const forward = target.camera.getForwardRay().direction;
      const horizontalForwardLength = Math.hypot(forward.x, forward.z);
      const forwardX = horizontalForwardLength > 0.001 ? forward.x / horizontalForwardLength : 0;
      const forwardZ = horizontalForwardLength > 0.001 ? forward.z / horizontalForwardLength : 1;
      const clearDistance = SPAWN_CANDIDATE_DISTANCES.find((distance) => {
        const candidateX = pos.x + forwardX * distance;
        const candidateZ = pos.z + forwardZ * distance;
        const dogTopY = getHeightAt(candidateX, candidateZ) + MECH_DOG_VISUAL_HEIGHT;
        for (let sample = 1; sample < 8; sample++) {
          const t = sample / 8;
          const sampleX = pos.x + (candidateX - pos.x) * t;
          const sampleZ = pos.z + (candidateZ - pos.z) * t;
          const sightlineY = pos.y + (dogTopY - pos.y) * t;
          if (getHeightAt(sampleX, sampleZ) + 0.05 > sightlineY) return false;
        }
        return true;
      }) ?? SPAWN_CANDIDATE_DISTANCES[SPAWN_CANDIDATE_DISTANCES.length - 1];
      this.position.x = pos.x + forwardX * clearDistance;
      this.position.z = pos.z + forwardZ * clearDistance;
      this.lastTargetX = pos.x;
      this.lastTargetZ = pos.z;
      this.spawned = true;
    }

    const targetDx = pos.x - this.lastTargetX;
    const targetDz = pos.z - this.lastTargetZ;
    const targetSpeed = dt > 0 ? Math.hypot(targetDx, targetDz) / dt : 0;
    this.lastTargetX = pos.x;
    this.lastTargetZ = pos.z;

    const dogDx = pos.x - this.position.x;
    const dogDz = pos.z - this.position.z;
    const dogDistance = Math.hypot(dogDx, dogDz);
    if (dogDistance > MECH_DOG_STANDOFF_DISTANCE) {
      this.pursuit.update(dt, targetSpeed, pos, this.position, true, targetIsCrouching);
    }
    const groundY = getHeightAt(this.position.x, this.position.z);
    this.body.update(dt, this.position, groundY);
  }
}
