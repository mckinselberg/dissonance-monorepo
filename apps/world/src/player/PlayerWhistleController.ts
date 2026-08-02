import type { WhistleNote } from '@dissonance/audio/babylon';
import { signal } from '@preact/signals';
import { WHISTLE_MELODIES, type WhistleMelody } from '../state/whistle';

/** Owns the player's selected whistle and emits the audible player action. */
export class PlayerWhistleController {
  readonly melodyIndex = signal(0);

  constructor(private readonly playWhistle: (notes: WhistleNote[]) => void) {}

  get selectedMelody(): WhistleMelody {
    return WHISTLE_MELODIES[this.melodyIndex.value];
  }

  get melodyCount(): number {
    return WHISTLE_MELODIES.length;
  }

  selectMelody(index: number): void {
    if (index >= 0 && index < WHISTLE_MELODIES.length) this.melodyIndex.value = index;
  }

  whistle(): void {
    this.playWhistle(this.selectedMelody.notes);
  }
}
