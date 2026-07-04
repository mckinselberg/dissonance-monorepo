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
  stunMin: number;
  stunRange: number;
  orbitStrength: number;
  reengageDelay: number;
}

export class PursuerSystem {
  private model: PursuerModel;
  private stunTimer = 0;
  private reengageTimer = 0;
  private beamHesitationTimer = 0;
  private wasIlluminated = false;
  private wasPressured = false;
  private orbitDir = Math.random() < 0.5 ? -1 : 1;

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
    flashlightPressure = isIlluminated ? 1 : 0,
  ): void {
    const cfg = this.config;

    const dx = playerPos.x - pursuerPos.x;
    const dz = playerPos.z - pursuerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (isIlluminated) {
      // First frame caught in the beam → freeze briefly before fleeing.
      if (!this.wasIlluminated) this.stunTimer = cfg.stunMin + Math.random() * cfg.stunRange;
      this.wasIlluminated = true;
      this.reengageTimer = cfg.reengageDelay;

      this.model.aggression = Math.max(0, this.model.aggression - cfg.stillAggressionLoss * 4 * dt);

      if (this.stunTimer > 0) {
        this.stunTimer -= dt; // frozen — no movement
      } else if (dist > 0.01) {
        const fleeSpeed = cfg.maxSpeed * 1.1;
        const move = Math.min(fleeSpeed * dt, dist);
        pursuerPos.x -= (dx / dist) * move;
        pursuerPos.z -= (dz / dist) * move;
      }
    } else {
      this.wasIlluminated = false;
      this.reengageTimer = Math.max(0, this.reengageTimer - dt);
      this.beamHesitationTimer = Math.max(0, this.beamHesitationTimer - dt);

      const pressureClose = hasLoS && dist < 20 && flashlightPressure > 0.32;
      if (pressureClose && !this.wasPressured) {
        this.beamHesitationTimer = Math.max(
          this.beamHesitationTimer,
          0.35 + flashlightPressure * 0.45,
        );
      }
      this.wasPressured = pressureClose;

      if (playerSpeed > 8.5) {
        this.model.aggression = Math.min(1, this.model.aggression + cfg.sprintAggressionGain * dt);
      } else if (!hasLoS && isCrouching) {
        this.model.aggression = Math.max(0, this.model.aggression - cfg.stillAggressionLoss * 3.5 * dt);
      } else if (pressureClose) {
        this.model.aggression = Math.max(0, this.model.aggression - cfg.stillAggressionLoss * 2.0 * dt);
      } else if (!hasLoS) {
        this.model.aggression = Math.max(0, this.model.aggression - cfg.aggressionDecayRate * 2.5 * dt);
      } else if (playerSpeed < 0.5) {
        this.model.aggression = Math.max(0, this.model.aggression - cfg.stillAggressionLoss * dt);
      } else {
        this.model.aggression = Math.max(0, this.model.aggression - cfg.aggressionDecayRate * dt);
      }

      const losScale = hasLoS ? 1.0 : 0.55;
      // Slow to ~35% when very close — gives the player time to pivot and
      // shine the flashlight before being caught.
      const STALK_THRESHOLD = 15.0;
      const closeScale = dist < STALK_THRESHOLD
        ? 0.35 + 0.65 * (dist / STALK_THRESHOLD)
        : 1.0;
      const reengageScale = this.reengageTimer > 0 ? 0.48 : 1.0;
      const beamScale = this.beamHesitationTimer > 0
        ? 0.10
        : 1.0 - Math.min(0.58, flashlightPressure * 0.58);
      const speed = (cfg.baseSpeed + this.model.aggression * (cfg.maxSpeed - cfg.baseSpeed))
        * losScale * closeScale * reengageScale * beamScale;

      if (dist > 0.01) {
        const move = Math.min(speed * dt, dist);
        const closeT = Math.max(0, Math.min(1, (cfg.nearThreshold - dist) / cfg.nearThreshold));
        const orbit = cfg.orbitStrength * closeT * (hasLoS ? 1.0 : 0.35);
        if (closeT > 0.7 && Math.random() < dt * 0.25) this.orbitDir *= -1;

        const nx = dx / dist;
        const nz = dz / dist;
        const tx = -nz * this.orbitDir;
        const tz = nx * this.orbitDir;
        const mx = nx * (1 - orbit) + tx * orbit;
        const mz = nz * (1 - orbit) + tz * orbit;
        const ml = Math.sqrt(mx * mx + mz * mz) || 1;
        pursuerPos.x += (mx / ml) * move;
        pursuerPos.z += (mz / ml) * move;
      }
    }

    const finalDx = playerPos.x - pursuerPos.x;
    const finalDz = playerPos.z - pursuerPos.z;
    const finalDist = Math.sqrt(finalDx * finalDx + finalDz * finalDz);
    const detectionScale = isCrouching ? 0.55 : 1.0;
    this.model.distance  = finalDist;
    this.model.isHidden  = !hasLoS;
    this.model.state     = this.classifyState(finalDist, detectionScale);
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
    this.stunTimer = 0;
    this.reengageTimer = 0;
    this.beamHesitationTimer = 0;
    this.wasIlluminated = false;
    this.wasPressured = false;
    this.orbitDir = Math.random() < 0.5 ? -1 : 1;
  }
}
