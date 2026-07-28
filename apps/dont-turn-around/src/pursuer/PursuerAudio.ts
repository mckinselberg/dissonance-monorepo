import { AudioEngine } from '@dissonance/audio';
import type { PursuerState } from '@dissonance/shared-types';
import { TieredProximityAudioScheduler, type ProximityAudioChannel } from '@dissonance/pursuer';

type AudibleState = Exclude<PursuerState, 'caught'>;

const CHANNELS: ProximityAudioChannel<AudibleState>[] = [
  {
    id: 'snap',
    tiers: {
      far: {
        minInterval: 10, intervalRange: 14, maskScale: 0.8,
        play: (pan) => AudioEngine.playBranchSnap(pan, -40 + Math.random() * 5),
      },
      close: {
        minInterval: 1.4, intervalRange: 1.8, maskScale: 0.2,
        play: (pan) => AudioEngine.playBranchSnap(pan, -5 + Math.random() * 3),
      },
    },
  },
  {
    id: 'footstep',
    tiers: {
      near: {
        minInterval: 0.85, intervalRange: 0.55, maskScale: 0.5,
        play: (pan) => AudioEngine.playPursuerStep(pan, -22 + Math.random() * 3, Math.random() < 0.10),
      },
      close: {
        minInterval: 0.38, intervalRange: 0.20, maskScale: 0.25,
        play: (pan) => AudioEngine.playPursuerStep(pan, -6 + Math.random() * 3, Math.random() < 0.18),
      },
    },
  },
  {
    id: 'rustle',
    tiers: {
      near: {
        minInterval: 2.8, intervalRange: 3.5, maskScale: 0.4,
        play: (pan) => AudioEngine.playLeafRustle(pan, -22 + Math.random() * 4),
      },
      close: {
        minInterval: 0.7, intervalRange: 0.9, maskScale: 0.2,
        play: (pan) => AudioEngine.playLeafRustle(pan, -7 + Math.random() * 3),
      },
    },
  },
  {
    id: 'growl',
    initialTimer: 3.5,
    tiers: {
      near: {
        minInterval: 7.0, intervalRange: 5.0, maskScale: 0.35,
        play: (pan) => AudioEngine.playPursuerGrowl(pan, -24 + Math.random() * 3, 0.35),
      },
      close: {
        minInterval: 2.4, intervalRange: 2.2, maskScale: 0.15,
        play: (pan) => AudioEngine.playPursuerGrowl(pan, -13 + Math.random() * 3, 0.8),
      },
    },
  },
];

export class PursuerAudio {
  private muted = false;
  private scheduler = new TieredProximityAudioScheduler<AudibleState>(CHANNELS);

  setMuted(muted: boolean): void { this.muted = muted; }

  update(dt: number, pursuerAngle: number, state: PursuerState, weatherMask: number): void {
    if (this.muted || state === 'caught') return;
    this.scheduler.update(dt, state, pursuerAngle, weatherMask);
  }
}
