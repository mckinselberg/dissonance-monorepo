import type { TrailDefinition } from '../config/trails';
import { artifactIconSvg } from './ArtifactIcon';

// Shown once at the start of a run (and again after a restart) so the
// player knows what they're looking for before they set off — a preview
// card for the trail's artifact plus whatever this trail specifically
// needs to teach (phone/watcher for Morrow, the key fob for Stonejaw, etc).
export class TrailIntroOverlay {
  private readonly el: HTMLElement;
  private hideTimer: number | null = null;
  private removeTimer: number | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:fixed',
      'top:28px',
      'left:50%',
      'transform:translateX(-50%) translateY(-10px)',
      'pointer-events:none',
      'z-index:92',
      'box-sizing:border-box',
      'width:min(420px, calc(100vw - 40px))',
      'padding:16px 18px',
      'background:rgba(0,0,0,0.74)',
      'border:1px solid rgba(255,255,255,0.10)',
      'border-radius:4px',
      'color:rgba(210,218,222,0.9)',
      'font-family:monospace',
      'opacity:0',
      'transition:opacity 320ms ease, transform 320ms ease',
    ].join(';');
    document.body.appendChild(this.el);
  }

  show(trail: TrailDefinition, durationMs = 8000): void {
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    if (this.removeTimer !== null) window.clearTimeout(this.removeTimer);

    this.el.innerHTML = `
      <div style="font-size:0.6rem;letter-spacing:0.26em;color:rgba(160,170,170,0.55);margin-bottom:10px">
        ${trail.name.toUpperCase()}
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="flex:none;color:rgba(220,225,225,0.85)">${artifactIconSvg(trail.artifact.icon)}</div>
        <div>
          <div style="font-size:0.6rem;letter-spacing:0.16em;color:rgba(150,160,160,0.6)">RECOVER</div>
          <div style="font-size:0.82rem;color:rgba(230,232,225,0.92)">${trail.artifact.name}</div>
        </div>
      </div>
      ${trail.introNote ? `
        <div style="font-size:0.68rem;line-height:1.6;color:rgba(185,193,193,0.75);margin-bottom:10px">
          ${trail.introNote}
        </div>
      ` : ''}
      <div style="font-size:0.66rem;line-height:1.6;color:rgba(150,160,160,0.62)">
        ${trail.startHint}
      </div>
    `;

    this.el.style.opacity = '1';
    this.el.style.transform = 'translateX(-50%) translateY(0)';

    this.hideTimer = window.setTimeout(() => {
      this.el.style.opacity = '0';
      this.el.style.transform = 'translateX(-50%) translateY(-10px)';
    }, durationMs);
  }

  dispose(): void {
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    if (this.removeTimer !== null) window.clearTimeout(this.removeTimer);
    this.el.remove();
  }
}
