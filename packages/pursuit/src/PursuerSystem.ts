import type { PursuerModel, PursuerState } from '@dissonance/shared-types';

export interface PursuerConfig {
  startDistance: number;
  baseSpeed: number;
  maxSpeed: number;
  catchRadius: number;
  nearThreshold: number;
  closeThreshold: number;
  sprintAggressionGain: number;
  stillAggressionLoss: number;
  aggressionDecayRate: number;
}

export class PursuerSystem {
  private model: PursuerModel;

  constructor(
    private readonly config: PursuerConfig,
    startDistance: number = config.startDistance,
  ) {
    this.model = { distance: startDistance, state: 'far', aggression: 0, isHidden: false };
  }

  update(
    dt: number,
    playerSpeed: number,
    playerPos: { x: number; z: number },
    pursuerPos: { x: number; z: number },
    hasLoS: boolean,
    isCrouching: boolean,
    isIlluminated = false,
  ): void {
    const cfg = this.config;

    const dx = playerPos.x - pursuerPos.x;
    const dz = playerPos.z - pursuerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (isIlluminated) {
      // Caught directly in the flashlight beam — break off and flee
      // instead of pressing the approach. Being seen is a liability, not
      // bait; aggression bleeds off fast like a spooked animal.
      this.model.aggression = Math.max(0, this.model.aggression - cfg.stillAggressionLoss * 4 * dt);
      if (dist > 0.01) {
        const fleeSpeed = cfg.maxSpeed * 1.1;
        const move = Math.min(fleeSpeed * dt, dist);
        pursuerPos.x -= (dx / dist) * move;
        pursuerPos.z -= (dz / dist) * move;
      }
    } else {
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

      const losScale = hasLoS ? 1.0 : 0.55;
      const speed = (cfg.baseSpeed + this.model.aggression * (cfg.maxSpeed - cfg.baseSpeed)) * losScale;

      if (dist > 0.01) {
        const move = Math.min(speed * dt, dist);
        pursuerPos.x += (dx / dist) * move;
        pursuerPos.z += (dz / dist) * move;
      }
    }

    const detectionScale = isCrouching ? 0.55 : 1.0;
    this.model.distance  = dist;
    this.model.isHidden  = !hasLoS;
    this.model.state     = this.classifyState(dist, detectionScale);
  }

  private classifyState(dist: number, detectionScale: number): PursuerState {
    if (dist <= this.config.catchRadius) return 'caught';
    if (dist <= this.config.closeThreshold * detectionScale) return 'close';
    if (dist <= this.config.nearThreshold  * detectionScale) return 'near';
    return 'far';
  }

  getModel(): Readonly<PursuerModel> { return this.model; }

  reset(startDistance: number = this.config.startDistance): void {
    this.model = { distance: startDistance, state: 'far', aggression: 0, isHidden: false };
  }
}
