import { AudioEngine } from '@dissonance/audio';
import type { PursuerState } from '@dissonance/shared-types';

// EXTRACTION CANDIDATE: the tiered timer-based event scheduling pattern here
// (probability-gated timers per proximity tier, scaled by weatherMask) is
// reusable, but the sound content (branch snaps, leaf rustle, footstep
// cracks) is forest/DTA-specific. Revisit extraction when a second app
// (e.g. Dissonance's SignalNet patrol audio) needs the same scheduling shape
// with injected sound callbacks instead of hardcoded AudioEngine.play* calls.
export class PursuerAudio {
  private footstepTimer = 0;
  private rustleTimer = 0;
  private snapTimer = 0;
  private muted = false;

  setMuted(muted: boolean): void { this.muted = muted; }

  update(dt: number, pursuerAngle: number, state: PursuerState, weatherMask: number): void {
    if (this.muted || state === 'caught') return;
    if (state === 'far')   this.updateFar(dt, pursuerAngle, weatherMask);
    if (state === 'near')  this.updateNear(dt, pursuerAngle, weatherMask);
    if (state === 'close') this.updateClose(dt, pursuerAngle, weatherMask);
  }

  private updateFar(dt: number, pan: number, mask: number): void {
    this.snapTimer -= dt;
    if (this.snapTimer <= 0) {
      this.snapTimer = 10 + Math.random() * 14;
      if (Math.random() > mask * 0.8) {
        AudioEngine.playBranchSnap(pan, -40 + Math.random() * 5);
      }
    }
  }

  private updateNear(dt: number, pan: number, mask: number): void {
    this.footstepTimer -= dt;
    if (this.footstepTimer <= 0) {
      this.footstepTimer = 0.85 + Math.random() * 0.55;
      if (Math.random() > mask * 0.5) {
        const vol = -22 + Math.random() * 3;
        const crack = Math.random() < 0.28;
        AudioEngine.playPursuerStep(pan, vol, crack);
      }
    }

    this.rustleTimer -= dt;
    if (this.rustleTimer <= 0) {
      this.rustleTimer = 2.8 + Math.random() * 3.5;
      if (Math.random() > mask * 0.4) {
        AudioEngine.playLeafRustle(pan, -22 + Math.random() * 4);
      }
    }
  }

  private updateClose(dt: number, pan: number, mask: number): void {
    this.footstepTimer -= dt;
    if (this.footstepTimer <= 0) {
      this.footstepTimer = 0.38 + Math.random() * 0.20;
      if (Math.random() > mask * 0.25) {
        const vol = -6 + Math.random() * 3;
        const crack = Math.random() < 0.38;
        AudioEngine.playPursuerStep(pan, vol, crack);
      }
    }

    this.rustleTimer -= dt;
    if (this.rustleTimer <= 0) {
      this.rustleTimer = 0.7 + Math.random() * 0.9;
      if (Math.random() > mask * 0.2) {
        AudioEngine.playLeafRustle(pan, -7 + Math.random() * 3);
      }
    }

    this.snapTimer -= dt;
    if (this.snapTimer <= 0) {
      this.snapTimer = 1.4 + Math.random() * 1.8;
      if (Math.random() > mask * 0.2) {
        AudioEngine.playBranchSnap(pan, -5 + Math.random() * 3);
      }
    }
  }
}
