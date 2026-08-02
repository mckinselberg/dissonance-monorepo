import type { WhistleNote } from '@dissonance/audio/babylon';

export type WhistleMelody = {
  label: string;
  notes: WhistleNote[];
};

// Number keys 1-9 pick which of these plays on the next 'M' press (see
// main.tsx's keydown handler). A fixed, hand-picked list for now — the
// longer-term idea is a diegetic, player-composable call (a small
// MIDI-style step editor wired through BabylonWhistleAudio.playMelody)
// once there's more than one dog-like companion to call.
export const WHISTLE_MELODIES: WhistleMelody[] = [
  {
    label: 'Come here',
    notes: [
      { note: 'A4', time: 0, duration: 0.16 },
      { note: 'D5', time: 0.2, duration: 0.32 },
    ],
  },
  {
    label: 'Two-tone trill',
    notes: [
      { note: 'E5', time: 0, duration: 0.12 },
      { note: 'C5', time: 0.14, duration: 0.12 },
      { note: 'E5', time: 0.28, duration: 0.24 },
    ],
  },
  {
    label: 'Rising call',
    notes: [
      { note: 'G4', time: 0, duration: 0.14 },
      { note: 'C5', time: 0.16, duration: 0.14 },
      { note: 'G5', time: 0.32, duration: 0.3 },
    ],
  },
];
