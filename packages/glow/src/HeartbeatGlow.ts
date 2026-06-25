import type { Mesh, GlowLayer } from '@babylonjs/core';

/**
 * BPM-synced glow-pulse intensity driver for a mesh on a shared GlowLayer.
 * Tuning constants (5.5 / 2.5 / 0.14 / 13) are matched to HeartbeatAudio's
 * BPM curve in the dont-turn-around app — do not adjust without re-checking
 * that audio/visual sync.
 */
export class HeartbeatGlow {
  private stress = 0;
  private glowPhase = 0;

  constructor(
    private readonly mesh: Mesh,
    private readonly glow: GlowLayer,
  ) {
    this.glow.addIncludedOnlyMesh(this.mesh);
  }

  setStress(stress: number): void {
    this.stress = stress;
  }

  update(dt: number): void {
    const bpm = 65 + this.stress * 90;
    const cycleLen = 60 / bpm;
    this.glowPhase = (this.glowPhase + dt / cycleLen) % 1.0;

    const lub = Math.pow(Math.max(0, 1 - this.glowPhase * 5.5), 2.5);
    const dub = Math.pow(Math.max(0, 1 - Math.abs(this.glowPhase - 0.14) * 13), 2.5) * 0.55;
    const pulse = Math.max(lub, dub);

    const base    = 0.30 + this.stress * 0.50;
    const peakAdd = pulse * (0.85 + this.stress * 1.8);
    this.glow.intensity = base + peakAdd;
  }
}
