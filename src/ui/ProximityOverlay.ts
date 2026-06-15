import type { PursuerState } from '../types';

export class ProximityOverlay {
  private el: HTMLElement;
  private pulsePhase = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:fixed', 'inset:0', 'pointer-events:none',
      'z-index:50', 'opacity:0',
    ].join(';');
    document.body.appendChild(this.el);
  }

  update(dt: number, state: PursuerState, adrenaline: number): void {
    this.pulsePhase += dt;

    if (state === 'close') {
      // Pulse inward — faster pulse at higher adrenaline
      const rate   = 2.5 + adrenaline * 3.5;
      const pulse  = 0.5 + Math.sin(this.pulsePhase * rate) * 0.30;
      const base   = 0.30 + adrenaline * 0.40;
      this.el.style.opacity    = String(pulse * base);
      this.el.style.background = `radial-gradient(ellipse at center, transparent 28%, rgba(120,0,0,${pulse.toFixed(2)}) 100%)`;
    } else if (state === 'near') {
      const level = 0.07 + adrenaline * 0.11;
      this.el.style.opacity    = String(level);
      this.el.style.background = 'radial-gradient(ellipse at center, transparent 48%, rgba(50,0,0,0.75) 100%)';
    } else {
      this.el.style.opacity = '0';
    }
  }

  dispose(): void {
    this.el.remove();
  }
}
