// Visual companion to the existing breath audio layer (PlayerAudio/BreathSystem) —
// same DOM-overlay technique as ProximityOverlay, but driven by exertion rather
// than pursuer distance, and kept visually distinct (cool/dark vignette, not red)
// so exhaustion and danger don't compete for the same cue.
export class BreathOverlay {
  private el: HTMLElement;
  private phase = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:fixed', 'inset:0', 'pointer-events:none',
      'z-index:45', 'opacity:0',
      'background:radial-gradient(ellipse at center, transparent 52%, rgba(8,10,16,0.95) 100%)',
    ].join(';');
    document.body.appendChild(this.el);
  }

  update(dt: number, breathLoad: number): void {
    if (breathLoad < 0.04) {
      this.el.style.opacity = '0';
      return;
    }

    const rate = 1.1 + breathLoad * 2.0;
    this.phase += dt * rate;
    const cycle = 0.5 + Math.sin(this.phase) * 0.5;
    const intensity = breathLoad * (0.16 + cycle * 0.26);
    this.el.style.opacity = String(intensity);
  }

  dispose(): void {
    this.el.remove();
  }
}
