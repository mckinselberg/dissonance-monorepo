import type { PursuerModel, PursuerState } from '../types';
import { PURSUER_CONFIG } from '../config/runProfiles';

export class PursuerSystem {
  private model: PursuerModel;

  constructor(startDistance: number = PURSUER_CONFIG.startDistance) {
    this.model = {
      distance: startDistance,
      state: 'far',
      aggression: 0.0,
    };
  }

  // playerSpeed in units/s, playerPos and pursuerPos as {x,z} vectors
  update(
    dt: number,
    playerSpeed: number,
    playerPos: { x: number; z: number },
    pursuerPos: { x: number; z: number },
  ): void {
    const cfg = PURSUER_CONFIG;

    // Aggression rises when player sprints (noise), decays otherwise
    if (playerSpeed > 8.5) {
      this.model.aggression = Math.min(1, this.model.aggression + cfg.sprintAggressionGain * dt);
    } else if (playerSpeed < 0.5) {
      this.model.aggression = Math.max(0, this.model.aggression - cfg.stillAggressionLoss * dt);
    } else {
      this.model.aggression = Math.max(0, this.model.aggression - cfg.aggressionDecayRate * dt);
    }

    // Pursuer moves toward player at speed scaled by aggression
    const speed = cfg.baseSpeed + this.model.aggression * (cfg.maxSpeed - cfg.baseSpeed);
    const dx = playerPos.x - pursuerPos.x;
    const dz = playerPos.z - pursuerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.01) {
      const move = Math.min(speed * dt, dist);
      pursuerPos.x += (dx / dist) * move;
      pursuerPos.z += (dz / dist) * move;
    }

    this.model.distance = dist;
    this.model.state = this.classifyState(dist);
  }

  private classifyState(dist: number): PursuerState {
    if (dist <= PURSUER_CONFIG.catchRadius) return 'caught';
    if (dist <= PURSUER_CONFIG.closeThreshold) return 'close';
    if (dist <= PURSUER_CONFIG.nearThreshold) return 'near';
    return 'far';
  }

  getModel(): Readonly<PursuerModel> {
    return this.model;
  }

  reset(startDistance: number = PURSUER_CONFIG.startDistance): void {
    this.model = { distance: startDistance, state: 'far', aggression: 0 };
  }
}
