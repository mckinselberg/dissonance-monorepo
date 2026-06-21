import type { PursuerModel, PursuerState } from '@dta/shared-types';
import { PURSUER_CONFIG } from '../config/runProfiles';

export class PursuerSystem {
  private model: PursuerModel;

  constructor(startDistance: number = PURSUER_CONFIG.startDistance) {
    this.model = { distance: startDistance, state: 'far', aggression: 0, isHidden: false };
  }

  update(
    dt: number,
    playerSpeed: number,
    playerPos: { x: number; z: number },
    pursuerPos: { x: number; z: number },
    hasLoS: boolean,
    isCrouching: boolean,
  ): void {
    const cfg = PURSUER_CONFIG;

    if (playerSpeed > 8.5) {
      this.model.aggression = Math.min(1, this.model.aggression + cfg.sprintAggressionGain * dt);
    } else if (!hasLoS && isCrouching) {
      this.model.aggression = Math.max(0, this.model.aggression - cfg.stillAggressionLoss * 3.5 * dt);
    } else if (!hasLoS) {
      this.model.aggression = Math.max(0, this.model.aggression - cfg.aggressionDecayRate * 2.5 * dt);
    } else if (playerSpeed < 0.5) {
      this.model.aggression = Math.max(0, this.model.aggression - cfg.stillAggressionLoss * dt);
    } else {
      this.model.aggression = Math.max(0, this.model.aggression - cfg.aggressionDecayRate * dt);
    }

    const detectionScale = isCrouching ? 0.55 : 1.0;

    const losScale = hasLoS ? 1.0 : 0.55;
    const speed = (cfg.baseSpeed + this.model.aggression * (cfg.maxSpeed - cfg.baseSpeed)) * losScale;

    const dx = playerPos.x - pursuerPos.x;
    const dz = playerPos.z - pursuerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.01) {
      const move = Math.min(speed * dt, dist);
      pursuerPos.x += (dx / dist) * move;
      pursuerPos.z += (dz / dist) * move;
    }

    this.model.distance  = dist;
    this.model.isHidden  = !hasLoS;
    this.model.state     = this.classifyState(dist, detectionScale);
  }

  private classifyState(dist: number, detectionScale: number): PursuerState {
    if (dist <= PURSUER_CONFIG.catchRadius) return 'caught';
    if (dist <= PURSUER_CONFIG.closeThreshold * detectionScale) return 'close';
    if (dist <= PURSUER_CONFIG.nearThreshold  * detectionScale) return 'near';
    return 'far';
  }

  getModel(): Readonly<PursuerModel> { return this.model; }

  reset(startDistance: number = PURSUER_CONFIG.startDistance): void {
    this.model = { distance: startDistance, state: 'far', aggression: 0, isHidden: false };
  }
}
