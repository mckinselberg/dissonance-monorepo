import { AudioEngine } from '../audio/AudioEngine';
import type { PursuerState } from '../types';

// All sound from the pursuer — footsteps, branches, leaves
export class PursuerAudio {
  private footstepTimer = 0;
  private rustleTimer = 0;
  private snapTimer = 0;
  private muted = false;

  setMuted(muted: boolean): void { this.muted = muted; }

  // dt in seconds, pursuerAngle: angle from player forward (-1..1 pan), state, weatherMask 0..1
  update(dt: number, pursuerAngle: number, state: PursuerState, weatherMask: number): void {
    if (this.muted || state === 'caught') return;
    if (state === 'far') {
      this.updateFar(dt, pursuerAngle, weatherMask);
    } else if (state === 'near') {
      this.updateNear(dt, pursuerAngle, weatherMask);
    } else if (state === 'close') {
      this.updateClose(dt, pursuerAngle, weatherMask);
    }
  }

  private updateFar(dt: number, pan: number, mask: number): void {
    // Occasional very faint branch snaps / distant movement
    this.snapTimer -= dt;
    if (this.snapTimer <= 0) {
      this.snapTimer = 8 + Math.random() * 12;
      if (Math.random() > mask * 0.8) {
        AudioEngine.playBranchSnap(pan, -38 + Math.random() * 6);
      }
    }
  }

  private updateNear(dt: number, pan: number, mask: number): void {
    this.footstepTimer -= dt;
    if (this.footstepTimer <= 0) {
      this.footstepTimer = 0.9 + Math.random() * 0.6;
      if (Math.random() > mask * 0.5) {
        AudioEngine.playFootstep(pan, -26 + Math.random() * 4);
      }
    }

    this.rustleTimer -= dt;
    if (this.rustleTimer <= 0) {
      this.rustleTimer = 2.5 + Math.random() * 3;
      if (Math.random() > mask * 0.4) {
        AudioEngine.playLeafRustle(pan, -22 + Math.random() * 4);
      }
    }
  }

  private updateClose(dt: number, pan: number, mask: number): void {
    this.footstepTimer -= dt;
    if (this.footstepTimer <= 0) {
      this.footstepTimer = 0.45 + Math.random() * 0.25;
      // Close footsteps are louder and more varied
      if (Math.random() > mask * 0.25) {
        AudioEngine.playFootstep(pan, -10 + Math.random() * 4);
      }
    }

    this.rustleTimer -= dt;
    if (this.rustleTimer <= 0) {
      this.rustleTimer = 0.8 + Math.random() * 1.0;
      if (Math.random() > mask * 0.2) {
        AudioEngine.playLeafRustle(pan, -8 + Math.random() * 3);
      }
    }

    this.snapTimer -= dt;
    if (this.snapTimer <= 0) {
      this.snapTimer = 1.5 + Math.random() * 2;
      if (Math.random() > mask * 0.2) {
        AudioEngine.playBranchSnap(pan, -6 + Math.random() * 3);
      }
    }
  }
}

// Extend AudioEngine with volume param for branch snap
declare module '../audio/AudioEngine' {
  interface AudioEngineStatic {
    playBranchSnap(panValue?: number, volume?: number): void;
  }
}
