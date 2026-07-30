import { Vector3 } from '@babylonjs/core';
import { STRIKE_CONSTANTS } from './strikeConstants';

export interface RecoveryFlags {
  emitterAcquired: boolean;
  chassisRecovered: boolean;
}

export class DroneRecovery {
  private recoverablePosition: Vector3 | null = null;
  private flags: RecoveryFlags = {
    emitterAcquired: false,
    chassisRecovered: false,
  };

  markRecoverable(position: Vector3): void {
    this.recoverablePosition = position.clone();
  }

  restore(flags: RecoveryFlags, recoverablePosition: Vector3 | null): void {
    this.flags = { ...flags };
    this.recoverablePosition = recoverablePosition?.clone() ?? null;
  }

  isAvailable(playerPosition: Vector3): boolean {
    return (
      this.recoverablePosition !== null &&
      !this.flags.chassisRecovered &&
      Math.hypot(
        playerPosition.x - this.recoverablePosition.x,
        playerPosition.z - this.recoverablePosition.z,
      ) <=
        STRIKE_CONSTANTS.recoveryProximityRange
    );
  }

  recover(): RecoveryFlags | null {
    if (this.recoverablePosition === null || this.flags.chassisRecovered) return null;
    this.flags = { emitterAcquired: true, chassisRecovered: true };
    return { ...this.flags };
  }

  getFlags(): RecoveryFlags {
    return { ...this.flags };
  }
}
