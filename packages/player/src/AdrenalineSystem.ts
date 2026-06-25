import { PLAYER_CONFIG } from './defaults';
import type { PursuerState } from '@dissonance/shared-types';

export class AdrenalineSystem {
  private adrenaline = 0.0;

  update(dt: number, pursuerState: PursuerState): void {
    const target = this.stateToTarget(pursuerState);

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
