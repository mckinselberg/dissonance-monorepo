import { PLAYER_CONFIG } from '../config/runProfiles';

export class BreathSystem {
  private breathLoad = 0.0;  // 0..1

  update(dt: number, playerSpeed: number): void {
    const cfg = PLAYER_CONFIG;

    if (playerSpeed > 8.5) {
      // Sprinting
      this.breathLoad = Math.min(1, this.breathLoad + cfg.sprintBreathGain * dt);
    } else if (playerSpeed < 0.5) {
      // Standing still — fastest recovery
      this.breathLoad = Math.max(0, this.breathLoad - cfg.stillBreathLoss * dt);
    } else {
      // Walking/jogging
      this.breathLoad = Math.max(0, this.breathLoad - cfg.walkBreathLoss * dt);
    }
  }

  getLoad(): number {
    return this.breathLoad;
  }

  // Returns a speed multiplier (1.0 when fresh, lower when winded)
  getSpeedMultiplier(): number {
    return 1.0 - this.breathLoad * PLAYER_CONFIG.breathLoadSpeedPenalty;
  }

  reset(): void {
    this.breathLoad = 0;
  }
}
