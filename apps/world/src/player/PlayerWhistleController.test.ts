import { describe, expect, it, vi } from 'vitest';
import { WHISTLE_MELODIES } from '../state/whistle';
import { PlayerWhistleController } from './PlayerWhistleController';

describe('PlayerWhistleController', () => {
  it('owns melody selection and emits the selected player whistle', () => {
    const playWhistle = vi.fn();
    const controller = new PlayerWhistleController(playWhistle);

    controller.whistle();
    expect(playWhistle).toHaveBeenLastCalledWith(WHISTLE_MELODIES[0].notes);

    controller.selectMelody(2);
    controller.whistle();
    expect(controller.selectedMelody).toBe(WHISTLE_MELODIES[2]);
    expect(playWhistle).toHaveBeenLastCalledWith(WHISTLE_MELODIES[2].notes);
  });

  it('ignores melody selections outside the player vocabulary', () => {
    const controller = new PlayerWhistleController(vi.fn());

    controller.selectMelody(-1);
    controller.selectMelody(WHISTLE_MELODIES.length);

    expect(controller.melodyIndex.value).toBe(0);
  });
});
