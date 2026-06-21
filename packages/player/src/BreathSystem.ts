import { PLAYER_CONFIG } from './defaults';

export class BreathSystem {
  private breathLoad = 0.0;

  update(dt: number, playerSpeed: number): void {
    const cfg = PLAYER_CONFIG;

    if (playerSpeed > 8.5) {
      this.breathLoad = Math.min(1, this.breathLoad + cfg.sprintBreathGain * dt);
    } else if (playerSpeed < 0.5) {
      this.breathLoad = Math.max(0, this.breathLoad - cfg.stillBreathLoss * dt);
    } else {
      this.breathLoad = Math.max(0, this.breathLoad - cfg.walkBreathLoss * dt);
    }
  }

  getLoad(): number {
    return this.breathLoad;
  }

  getSpeedMultiplier(): number {
    return 1.0 - this.breathLoad * PLAYER_CONFIG.breathLoadSpeedPenalty;
  }

  reset(): void {
    this.breathLoad = 0;
  }
}
