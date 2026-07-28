import { signal, type Signal } from '@preact/signals';

// Not included: an "audioEnabled" signal. Browsers require a fresh user
// gesture to unlock an AudioContext on every page load — persisting "the
// user previously enabled audio" can't skip that gesture, so there's
// nothing meaningful to restore; the Enable Audio button always starts
// unclicked and needs a real click each load (see main.tsx).
export type AudioSignals = {
  masterMuted: Signal<boolean>;
  windVolume: Signal<number>;
  footstepMuted: Signal<boolean>;
  breathMuted: Signal<boolean>;
};

export function createAudioSignals(defaults: {
  masterMuted: boolean;
  windVolume: number;
  footstepMuted: boolean;
  breathMuted: boolean;
}): AudioSignals {
  return {
    masterMuted: signal(defaults.masterMuted),
    windVolume: signal(defaults.windVolume),
    footstepMuted: signal(defaults.footstepMuted),
    breathMuted: signal(defaults.breathMuted),
  };
}
