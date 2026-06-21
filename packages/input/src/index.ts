export type { MovementInputSource, MovementInputState } from '@dta/shared-types';

export class KeyboardInputSource {
  private keys: Record<string, boolean> = {};

  constructor() {
    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup',   (e) => { this.keys[e.code] = false; });
  }

  getState(): import('@dta/shared-types').MovementInputState {
    const w = !!this.keys['KeyW'];
    const s = !!this.keys['KeyS'];
    const a = !!this.keys['KeyA'];
    const d = !!this.keys['KeyD'];
    const shift = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const escape = !!this.keys['Escape'];

    const moving = w || s || a || d;
    const forward = (w ? 1 : 0) - (s ? 1 : 0);
    const turn = (d ? 1 : 0) - (a ? 1 : 0);

    return {
      source: 'keyboard',
      forwardAmount: forward,
      turnAmount: turn,
      runAmount: moving && shift ? 1 : 0,
      pauseRequested: escape,
    };
  }

  dispose(): void {
    this.keys = {};
  }
}
