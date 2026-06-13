import { PLAYER_CONFIG } from '../config/runProfiles';
import type { PursuerState } from '../types';

export class AdrenalineSystem {
  private adrenaline = 0.0;  // 0..1

  update(dt: number, pursuerState: PursuerState): void {
    const target = this.stateToTarget(pursuerState);

    // Rise quickly toward target, decay toward 0
    if (target > this.adrenaline) {
      this.adrenaline = Math.min(1, this.adrenaline + (target - this.adrenaline) * 2.0 * dt);
    } else {
      this.adrenaline = Math.max(0, this.adrenaline - PLAYER_CONFIG.adrenalineDecay * dt);
    }
  }

  private stateToTarget(state: PursuerState): number {
    switch (state) {
      case 'far':    return 0.05;
      case 'near':   return 0.35;
      case 'close':  return 0.80;
      case 'caught': return 1.00;
    }
  }

  getLevel(): number {
    return this.adrenaline;
  }

  // Camera shake magnitude — call per frame
  getShakeMagnitude(): number {
    return this.adrenaline * 0.012;
  }

  spike(amount: number): void {
    this.adrenaline = Math.min(1, this.adrenaline + amount);
  }

  reset(): void {
    this.adrenaline = 0;
  }
}
